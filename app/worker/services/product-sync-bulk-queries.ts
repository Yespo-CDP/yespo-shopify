import type { ShopMarketsConfig } from "~/@types/shopMarketsConfig";

import {
  countriesNeedOnlineStorePublication,
  publicationIdsForCountries,
} from "./market-catalogs";

const MAX_COUNTRIES_PER_CHUNK = 15;

export function sanitizeAlias(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, "_");
}

export function priceFieldAlias(countryCode: string): string {
  return sanitizeAlias(`price_${countryCode}`);
}

export function publishedFieldAlias(countryCode: string): string {
  return sanitizeAlias(`published_${countryCode}`);
}

export function publicationFieldAlias(publicationId: string): string {
  const numericId = publicationId.split("/").pop() ?? publicationId;
  return sanitizeAlias(`published_pub_${numericId}`);
}

export function splitCountriesIntoChunks(
  countries: string[],
  chunkSize = MAX_COUNTRIES_PER_CHUNK,
): string[][] {
  const chunks: string[][] = [];

  for (let index = 0; index < countries.length; index += chunkSize) {
    chunks.push(countries.slice(index, index + chunkSize));
  }

  return chunks.length > 0 ? chunks : [[]];
}

export interface BulkQueryOptions {
  countries?: string[];
}

/**
 * Builds a Shopify Bulk Operation query that fetches, for each product/variant,
 * per-country contextual pricing and whether the product is published on the
 * catalog attached to each market. A market with no catalog needs `status` and
 * `publishedAt` so the parser can keep active products published to the Online Store.
 *
 * Country codes are `CountryCode` enum values and are emitted unquoted in the
 * `context` argument. Publication ids are quoted GraphQL strings. Both are
 * sanitized when used as a field alias.
 */
export function buildBulkPricingQuery(
  config: ShopMarketsConfig,
  options: BulkQueryOptions = {},
): string {
  const countries = options.countries ?? config.countries;

  const pricingFields = countries
    .map(
      (country) => `
        ${priceFieldAlias(country)}: contextualPricing(context: { country: ${country} }) {
          price {
            amount
            currencyCode
          }
          compareAtPrice {
            amount
            currencyCode
          }
        }`,
    )
    .join("\n");

  const publishedFields = publicationIdsForCountries(config.markets, countries)
    .map(
      (publicationId) => `
        ${publicationFieldAlias(publicationId)}: publishedOnPublication(publicationId: ${JSON.stringify(publicationId)})`,
    )
    .join("\n");

  const onlineStoreFields = countriesNeedOnlineStorePublication(
    config.markets,
    countries,
  )
    ? `
        status
        publishedAt`
    : "";

  return `
{
  products {
    edges {
      node {
        id
        handle
        updatedAt
        ${onlineStoreFields}
        ${publishedFields}
        variants {
          edges {
            node {
              id
              updatedAt
              inventoryQuantity
              ${pricingFields}
            }
          }
        }
      }
    }
  }
}
`;
}

export function buildBulkQueryChunks(
  config: ShopMarketsConfig,
): Array<{ query: string; countries: string[] }> {
  const countryChunks = splitCountriesIntoChunks(config.countries);

  return countryChunks.map((countries) => ({
    countries,
    query: buildBulkPricingQuery(config, { countries }),
  }));
}
