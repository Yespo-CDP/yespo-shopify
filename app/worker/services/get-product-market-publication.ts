import type { GraphQLClient } from "@shopify/graphql-client";

import {
  publishedFieldAlias,
  splitCountriesIntoChunks,
} from "./product-sync-bulk-queries";

const PRODUCT_ID_CHUNK_SIZE = 50;

function isCountryCode(value: string): boolean {
  return /^[A-Z]{2}$/.test(value);
}

/**
 * Reads `publishedInContext` for each product and enabled market country.
 * Returns product GID → whether it is published in at least one of those countries.
 * An empty country list means the product is published in no market.
 */
export async function getPublishedInAnyMarket({
  client,
  productIds,
  countries,
}: {
  client: GraphQLClient;
  productIds: string[];
  countries: string[];
}): Promise<Map<string, boolean>> {
  const published = new Map<string, boolean>();
  for (const productId of productIds) {
    published.set(productId, false);
  }

  const safeCountries = countries.filter(isCountryCode);
  if (productIds.length === 0 || safeCountries.length === 0) {
    return published;
  }

  const countryChunks = splitCountriesIntoChunks(safeCountries);

  for (let index = 0; index < productIds.length; index += PRODUCT_ID_CHUNK_SIZE) {
    const idChunk = productIds.slice(index, index + PRODUCT_ID_CHUNK_SIZE);

    for (const countryChunk of countryChunks) {
      const fields = countryChunk
        .map(
          (country) =>
            `${publishedFieldAlias(country)}: publishedInContext(context: { country: ${country} })`,
        )
        .join("\n");

      const response = await client.request(
        `query productMarketPublication($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
              ${fields}
            }
          }
        }`,
        { variables: { ids: idChunk } },
      );

      const graphQLErrors = response?.errors?.graphQLErrors;
      if (
        (graphQLErrors && graphQLErrors.length > 0) ||
        response?.errors?.message
      ) {
        throw new Error(
          `Failed to read product market publication: ${JSON.stringify(response.errors)}`,
        );
      }

      const nodes = (response?.data as { nodes?: Array<Record<string, unknown> | null> })
        ?.nodes;
      if (!nodes) {
        throw new Error("Failed to read product market publication: empty response");
      }

      for (const node of nodes) {
        if (!node || typeof node.id !== "string") continue;
        const publishedHere = countryChunk.some(
          (country) => node[publishedFieldAlias(country)] === true,
        );
        if (publishedHere) {
          published.set(node.id, true);
        }
      }
    }
  }

  return published;
}
