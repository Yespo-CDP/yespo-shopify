import type { GraphQLClient } from "@shopify/graphql-client";

import type { ShopMarketsConfig } from "~/@types/shopMarketsConfig";

import {
  isPublishedOnMarketCatalog,
  publicationIdsForCountries,
} from "./market-catalogs";
import {
  priceFieldAlias,
  publicationFieldAlias,
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
  /** countryCode → product is on that market's attached catalog */
  publishedInCountry: Record<string, boolean>;
  variants: VariantContextualPricing[];
}

/**
 * Fetches per-country contextual pricing and catalog publication for a single
 * product and all its variants using regular GraphQL (not Bulk Operation).
 *
 * A country counts as published when the product is on an active catalog
 * attached to that country's market. Price still comes from contextual pricing.
 *
 * Uses the same alias naming convention as the bulk query
 * (`price_{CC}`, `published_pub_{publicationId}`).
 *
 * @param client - Shopify Admin GraphQL client
 * @param productGid - Product GID (e.g. "gid://shopify/Product/123")
 * @param config - Enabled markets, including each market's catalog publications
 */
export async function getProductContextualPricing({
  client,
  productGid,
  config,
}: {
  client: GraphQLClient;
  productGid: string;
  config: ShopMarketsConfig;
}): Promise<ProductContextualPricingResult | null> {
  const countries = config.countries;
  if (!countries.length) return null;

  const publicationIds = publicationIdsForCountries(config.markets, countries);
  const publishedFields = publicationIds
    .map(
      (publicationId) =>
        `${publicationFieldAlias(publicationId)}: publishedOnPublication(publicationId: ${JSON.stringify(publicationId)})`,
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
          publishedInCountry[cc] = false;
        }
        for (const market of config.markets) {
          const publishedByPublicationId = Object.fromEntries(
            market.catalogPublicationIds.map((publicationId) => [
              publicationId,
              product[publicationFieldAlias(publicationId)] === true,
            ]),
          );
          const published = isPublishedOnMarketCatalog(
            publishedByPublicationId,
            market.catalogPublicationIds,
          );
          for (const country of market.countries) {
            if (country in publishedInCountry) {
              publishedInCountry[country] = published;
            }
          }
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
