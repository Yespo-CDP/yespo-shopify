import { createGraphQLClient } from "@shopify/graphql-client";

import { ApiVersion } from "@shopify/shopify-app-remix/server";

export const createClient = (shop: string, accessToken: string) => {
  return createGraphQLClient({
    url: `https://${shop}/admin/api/${ApiVersion.April25}/graphql.json`,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    retries: 1,
  });
};
