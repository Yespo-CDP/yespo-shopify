import {
  createGraphQLClient,
  type GraphQLClient,
} from "@shopify/graphql-client";
import { ApiVersion } from "@shopify/shopify-app-react-router/server";
import type { ProductTranslationCategory } from "~/@types/product";

const STOREFRONT_TOKEN_TITLE = "Yespo taxonomy translations";

const tokenByShop = new Map<string, string>();
/** `${shop}:${categoryId}:${locale}` → translated taxonomy. Misses are not cached. */
const categoryByShopLocale = new Map<string, ProductTranslationCategory>();

const stripGid = (gid: string): string => gid.split("/").pop() ?? gid;

const cacheKey = (shop: string, categoryId: string, locale: string): string =>
  `${shop}:${stripGid(categoryId)}:${locale}`;

/** Shopify Storefront `LanguageCode` enum, e.g. "uk" → "UK", "pt-BR" → "PT_BR". */
const toStorefrontLanguage = (locale: string): string | null => {
  const code = locale.replace(/-/g, "_").toUpperCase();
  return /^[A-Z]{2}(_[A-Z0-9]{2,3})?$/.test(code) ? code : null;
};

const getStorefrontAccessToken = async (
  client: GraphQLClient,
  shop: string,
): Promise<string | null> => {
  const cached = tokenByShop.get(shop);
  if (cached) return cached;

  const listed = await client.request(
    `query getStorefrontAccessTokens {
      shop {
        storefrontAccessTokens(first: 100) {
          nodes { title accessToken }
        }
      }
    }`,
  );
  const nodes: Array<{ title?: string; accessToken?: string }> =
    (listed?.data as {
      shop?: {
        storefrontAccessTokens?: {
          nodes?: Array<{ title?: string; accessToken?: string }>;
        };
      };
    })?.shop?.storefrontAccessTokens?.nodes ?? [];

  const existing = nodes.find(
    (node) => node.title === STOREFRONT_TOKEN_TITLE && node.accessToken,
  );
  if (existing?.accessToken) {
    tokenByShop.set(shop, existing.accessToken);
    return existing.accessToken;
  }

  const created = await client.request(
    `mutation createStorefrontAccessToken($title: String!) {
      storefrontAccessTokenCreate(input: { title: $title }) {
        storefrontAccessToken { accessToken }
        userErrors { message }
      }
    }`,
    { variables: { title: STOREFRONT_TOKEN_TITLE } },
  );
  const payload = (
    created?.data as {
      storefrontAccessTokenCreate?: {
        storefrontAccessToken?: { accessToken?: string } | null;
        userErrors?: Array<{ message?: string }>;
      };
    }
  )?.storefrontAccessTokenCreate;
  const token = payload?.storefrontAccessToken?.accessToken;
  if (!token) {
    const message = payload?.userErrors
      ?.map((error) => error.message)
      .filter(Boolean)
      .join("; ");
    console.error(
      "[taxonomy] Failed to create a Storefront access token:",
      message || "no token returned",
    );
    return null;
  }

  tokenByShop.set(shop, token);
  return token;
};

const storefrontClientFor = (shop: string, accessToken: string): GraphQLClient =>
  createGraphQLClient({
    url: `https://${shop}/api/${ApiVersion.April26}/graphql.json`,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": accessToken,
    },
    retries: 1,
  });

interface StorefrontCategory {
  id: string;
  name: string;
  ancestors: Array<{ name: string }>;
}

/**
 * Localized Shopify standard taxonomy for one product and locale.
 * `ancestors` come from the immediate parent up to the root, so the Yespo
 * path is that chain reversed, plus the category's own name.
 */
const toYespoTaxonomy = (
  category: StorefrontCategory,
): ProductTranslationCategory | null => {
  if (!category.name) return null;

  const ancestorNames = [...category.ancestors]
    .reverse()
    .map((ancestor) => ancestor.name)
    .filter(Boolean);
  const path = [...ancestorNames, category.name];

  return {
    id: stripGid(category.id),
    name: category.name,
    ...(path.length > 0 ? { path } : {}),
    type: "category",
  };
};

const fetchLocalizedTaxonomy = async ({
  storefront,
  productId,
  locale,
}: {
  storefront: GraphQLClient;
  productId: string;
  locale: string;
}): Promise<ProductTranslationCategory | null> => {
  const language = toStorefrontLanguage(locale);
  if (!language) return null;

  const response = await storefront.request(
    `query getLocalizedTaxonomy($id: ID!) @inContext(language: ${language}) {
      product(id: $id) {
        category {
          id
          name
          ancestors { name }
        }
      }
    }`,
    { variables: { id: productId } },
  );

  const category = (
    response?.data as {
      product?: { category?: StorefrontCategory | null } | null;
    }
  )?.product?.category;
  return category ? toYespoTaxonomy(category) : null;
};

/**
 * Adds a translated Shopify taxonomy category (`type: "category"`) to each
 * locale that already has a product translation.
 *
 * Uses the Storefront API, because Admin `TaxonomyCategory` has no locale.
 * A failure leaves the locale unchanged so the payload builder can still copy
 * the primary-language taxonomy.
 */
export const attachLocalizedTaxonomyCategories = async ({
  client,
  shop,
  productId,
  categoryId,
  productResult,
}: {
  client: GraphQLClient;
  shop?: string;
  productId: string;
  categoryId?: string | null;
  productResult: Record<
    string,
    { categories?: ProductTranslationCategory[] }
  >;
}): Promise<void> => {
  const locales = Object.keys(productResult);
  if (!shop || !categoryId || locales.length === 0) return;

  try {
    const accessToken = await getStorefrontAccessToken(client, shop);
    if (!accessToken) return;

    const storefront = storefrontClientFor(shop, accessToken);

    await Promise.all(
      locales.map(async (locale) => {
        const key = cacheKey(shop, categoryId, locale);
        const cached = categoryByShopLocale.get(key);
        if (cached) {
          productResult[locale].categories = [
            ...(productResult[locale].categories ?? []),
            cached,
          ];
          return;
        }

        try {
          const taxonomy = await fetchLocalizedTaxonomy({
            storefront,
            productId,
            locale,
          });
          if (taxonomy) {
            categoryByShopLocale.set(key, taxonomy);
            if (taxonomy.id) {
              categoryByShopLocale.set(
                cacheKey(shop, taxonomy.id, locale),
                taxonomy,
              );
            }
            productResult[locale].categories = [
              ...(productResult[locale].categories ?? []),
              taxonomy,
            ];
          }
        } catch (error) {
          console.error(
            `[taxonomy] Failed to fetch ${locale} taxonomy for ${productId}:`,
            error,
          );
        }
      }),
    );
  } catch (error) {
    console.error(
      "[taxonomy] Failed to fetch localized taxonomy:",
      error,
    );
  }
};
