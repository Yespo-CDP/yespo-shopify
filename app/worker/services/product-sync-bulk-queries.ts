import type { ShopMarketsConfig } from "~/@types/shopMarketsConfig";

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
 * the per-country contextual pricing and the per-country publication state.
 *
 * Country codes are `CountryCode` enum values and are emitted unquoted in the
 * `context` argument; they are sanitized only when used as a field alias.
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

  const publishedFields = countries
    .map(
      (country) => `
        ${publishedFieldAlias(country)}: publishedInContext(context: { country: ${country} })`,
    )
    .join("\n");

  return `
{
  products {
    edges {
      node {
        id
        handle
        updatedAt
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
