import type { GraphQLClient } from "@shopify/graphql-client";

import { getShopPrimaryLocale } from "./get-shop-primary-locale";

/**
 * Resolves Yespo POST /v1/products language envelope fields for a sync request.
 *
 * Uses the live Shopify primary locale when a GraphQL client is available,
 * falling back to the value stored in the database.
 */
export async function resolveProductSyncLanguage({
  client,
  storedLanguageCode,
}: {
  client: GraphQLClient | null;
  storedLanguageCode?: string | null;
}): Promise<{
  languageCode: string;
  needsLanguageCodePersist: boolean;
}> {
  const currentLocale = client
    ? await getShopPrimaryLocale({ client })
    : null;
  const languageCode = currentLocale ?? storedLanguageCode ?? "en";
  const needsLanguageCodePersist = languageCode !== storedLanguageCode;

  return { languageCode, needsLanguageCodePersist };
}
