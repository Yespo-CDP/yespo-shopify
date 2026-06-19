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

export function translationFieldAlias(locale: string, scope: string): string {
  return sanitizeAlias(`tr_${locale}_${scope}`);
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
  includeTranslations?: boolean;
}

export function buildBulkPricingTranslationsQuery(
  config: ShopMarketsConfig,
  options: BulkQueryOptions = {},
): string {
  const countries = options.countries ?? config.countries;
  const includeTranslations = options.includeTranslations ?? true;

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

  const translationAliases = new Set<string>();
  const translationFields: string[] = [];

  if (includeTranslations) {
    for (const market of config.markets) {
      for (const locale of market.locales) {
        const alias = translationFieldAlias(locale, market.handle);
        if (translationAliases.has(alias)) {
          continue;
        }
        translationAliases.add(alias);
        translationFields.push(`
        ${alias}: translations(
          locale: "${locale}"
          marketId: "${market.id}"
        ) {
          key
          value
          locale
          market {
            id
            handle
          }
        }`);
      }
    }

    for (const locale of config.locales) {
      const alias = translationFieldAlias(locale, "global");
      if (translationAliases.has(alias)) {
        continue;
      }
      translationAliases.add(alias);
      translationFields.push(`
        ${alias}: translations(locale: "${locale}") {
          key
          value
          locale
          market {
            id
            handle
          }
        }`);
    }
  }

  return `
{
  products {
    edges {
      node {
        id
        title
        descriptionHtml
        handle
        updatedAt
        ${publishedFields}
        ${translationFields.join("\n")}
        variants {
          edges {
            node {
              id
              updatedAt
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

  return countryChunks.map((countries, index) => ({
    countries,
    query: buildBulkPricingTranslationsQuery(config, {
      countries,
      includeTranslations: index === 0,
    }),
  }));
}
