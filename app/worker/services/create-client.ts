import {
  createGraphQLClient,
  type GraphQLClient,
} from "@shopify/graphql-client";

import { ApiVersion } from "@shopify/shopify-app-react-router/server";

/**
 * Create Shopify GraphQL API.
 *
 * This function create new shopify client by `shop` and `accessToken`.
 *
 * @param {Object} params - The input parameters.
 * @param {string} params.shop - The unique URL identifier of the shop.
 * @param {string} params.accessToken - Access token from shopify session.
 * @returns {GraphQLClient} New shopify graphql client GraphQLClient.
 *
 * @example
  const client = createClient({ shop, accessToken });
    const response = await client.request(
      `...`,
    );
 */
export const createClient = ({
  shop,
  accessToken,
}: {
  shop: string;
  accessToken: string;
}): GraphQLClient => {
  return createGraphQLClient({
    url: `https://${shop}/admin/api/${ApiVersion.July25}/graphql.json`,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    retries: 1,
  });
};
