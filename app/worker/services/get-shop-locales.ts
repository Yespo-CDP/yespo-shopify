import type { GraphQLClient } from "@shopify/graphql-client";

interface ShopLocalesResponse {
  shopLocales: Array<{
    locale: string;
    primary: boolean;
    published: boolean;
  }>;
}

/**
 * Returns all published non-primary locales for the shop.
 *
 * These are the locales for which we need to fetch product translations
 * and include them in the Yespo `translations` array.
 *
 * @param client - Shopify GraphQL Admin API client
 * @param primaryLocale - The primary locale already used as the base language
 * @returns Array of locale codes to translate (e.g. ["uk", "fr"])
 */
export const getShopSecondaryLocales = async ({
  client,
  primaryLocale,
}: {
  client: GraphQLClient;
  primaryLocale: string;
}): Promise<string[]> => {
  try {
    const response = await client.request(
      `query getShopLocales {
        shopLocales {
          locale
          primary
          published
        }
      }`,
    );
    const locales = (response?.data as ShopLocalesResponse)?.shopLocales ?? [];

    const secondary = locales
      .filter((l) => l.published && !l.primary && l.locale !== primaryLocale)
      .map((l) => l.locale);

    return secondary;
  } catch (error) {
    console.error("[locales] Failed to fetch shop locales:", error);
    return [];
  }
};
