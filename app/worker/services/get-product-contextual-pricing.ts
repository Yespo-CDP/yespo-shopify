import type { GraphQLClient } from "@shopify/graphql-client";

import {
  priceFieldAlias,
  publishedFieldAlias,
} from "./product-sync-bulk-queries";

export interface VariantContextualPricing {
  variantId: string;
  updatedAt: string;
  inventoryQuantity: number | null;
  perCountry: Record<
    string,
    {
      price: { amount: string; currencyCode: string } | null;
      compareAtPrice: { amount: string; currencyCode: string } | null;
    }
  >;
}

export interface ProductContextualPricingResult {
  productId: string;
  handle: string;
  /** countryCode → is published in that market */
  publishedInCountry: Record<string, boolean>;
  variants: VariantContextualPricing[];
}

/**
 * Fetches per-country contextual pricing and publication state for a single
 * product and all its variants using regular GraphQL (not Bulk Operation).
 *
 * Uses the same alias naming convention as the bulk query
 * (`price_{CC}`, `published_{CC}`) so the downstream mapping logic is reusable.
 *
 * Limitation: fetches up to 250 variants in a single query. Products with more
 * than 250 variants will have remaining variants silently omitted.
 *
 * @param client - Shopify Admin GraphQL client
 * @param productGid - Product GID (e.g. "gid://shopify/Product/123")
 * @param countries - List of country codes to query (e.g. ["US", "CA", "UA"])
 */
export async function getProductContextualPricing({
  client,
  productGid,
  countries,
}: {
  client: GraphQLClient;
  productGid: string;
  countries: string[];
}): Promise<ProductContextualPricingResult | null> {
  if (!countries.length) return null;

  const publishedFields = countries
    .map(
      (cc) =>
        `${publishedFieldAlias(cc)}: publishedInContext(context: { country: ${cc} })`,
    )
    .join("\n      ");

  const pricingFields = countries
    .map(
      (cc) => `
      ${priceFieldAlias(cc)}: contextualPricing(context: { country: ${cc} }) {
        price { amount currencyCode }
        compareAtPrice { amount currencyCode }
      }`,
    )
    .join("\n");

  const query = `
    query getProductContextualPricing($productId: ID!, $after: String) {
      product(id: $productId) {
        id
        handle
        ${publishedFields}
        variants(first: 250, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            updatedAt
            inventoryQuantity
            ${pricingFields}
          }
        }
      }
    }
  `;

  try {
    const allVariants: VariantContextualPricing[] = [];
    let cursor: string | null = null;
    let productId = "";
    let handle = "";
    const publishedInCountry: Record<string, boolean> = {};

    do {
      const response: any = await client.request(query, {
        variables: { productId: productGid, after: cursor },
      });

      const product: any = response?.data?.product;
      if (!product) return null;

      // Capture product-level fields on first page only
      if (!productId) {
        productId = product.id;
        handle = product.handle;
        for (const cc of countries) {
          publishedInCountry[cc] = Boolean(product[publishedFieldAlias(cc)]);
        }
      }

      const page: any = product.variants;
      for (const v of page?.nodes ?? []) {
        const perCountry: VariantContextualPricing["perCountry"] = {};
        for (const cc of countries) {
          const pricing = v[priceFieldAlias(cc)];
          perCountry[cc] = {
            price: pricing?.price ?? null,
            compareAtPrice: pricing?.compareAtPrice ?? null,
          };
        }
        allVariants.push({
          variantId: v.id,
          updatedAt: v.updatedAt,
          inventoryQuantity: v.inventoryQuantity ?? null,
          perCountry,
        });
      }

      cursor = page?.pageInfo?.hasNextPage ? page.pageInfo.endCursor : null;
    } while (cursor);

    return { productId, handle, publishedInCountry, variants: allVariants };
  } catch (error) {
    console.error(
      "[market-webhook] Failed to fetch contextual pricing:",
      error,
    );
    return null;
  }
}
