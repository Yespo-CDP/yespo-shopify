import type { GraphQLClient } from "@shopify/graphql-client";

interface ShopLocaleResponse {
  shop: {
    primaryLocale: string;
  };
}

/**
 * Fetches the primary locale of the Shopify store.
 *
 * The returned value is a BCP 47 language tag (e.g. "uk", "en", "de") which maps
 * directly to the `languageCode` field required by the Yespo POST /v1/products API.
 */
export const getShopPrimaryLocale = async ({
  client,
}: {
  client: GraphQLClient;
}): Promise<string | null> => {
  try {
    const response = await client.request(`
      query getShopPrimaryLocale {
        shop {
          primaryLocale
        }
      }
    `);

    const data = response?.data as ShopLocaleResponse;
    return data?.shop?.primaryLocale ?? null;
  } catch (error) {
    console.error("Failed to fetch shop primary locale:", error);
    return null;
  }
};
