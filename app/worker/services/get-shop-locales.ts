import type { GraphQLClient } from "@shopify/graphql-client";

interface ShopLocalesResponse {
  shopLocales: Array<{
    locale: string;
    primary: boolean;
    published: boolean;
  }>;
}

/**
 * Returns the language of the products sent to Yespo and the locales to
 * translate them to.
 *
 * Yespo fixes the site language by the first accepted request, so the stored
 * language wins over the current Shopify primary locale. When Shopify does not
 * return the locales, the stored language (or "en") is used without translations.
 *
 * @param client - Shopify GraphQL Admin API client
 * @param storedLanguageCode - `Shop.defaultLanguageCode`, null until the first accepted request
 * @returns `languageCode` (e.g. "uk") and the other published non-primary locales (e.g. ["en", "fr"])
 */
export const getShopLanguages = async ({
  client,
  storedLanguageCode,
}: {
  client: GraphQLClient;
  storedLanguageCode: string | null;
}): Promise<{ languageCode: string; secondaryLocales: string[] }> => {
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

    // The client returns GraphQL errors instead of throwing them.
    if (response.errors) {
      throw new Error(JSON.stringify(response.errors));
    }

    const locales = (response.data as ShopLocalesResponse)?.shopLocales ?? [];
    const primary = locales.find((l) => l.primary);
    if (!primary) {
      throw new Error("no primary locale in the response");
    }

    const languageCode = storedLanguageCode ?? primary.locale;
    const secondaryLocales = locales
      .filter((l) => l.published && !l.primary && l.locale !== languageCode)
      .map((l) => l.locale);

    return { languageCode, secondaryLocales };
  } catch (error) {
    console.error(
      "[locales] Failed to fetch shop locales:",
      error instanceof Error ? error.message : error,
    );
    return { languageCode: storedLanguageCode ?? "en", secondaryLocales: [] };
  }
};
