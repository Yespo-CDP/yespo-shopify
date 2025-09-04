import type { GraphQLClient } from "@shopify/graphql-client";

/**
 * Fetches a count of orders from the Shopify store using the Admin GraphQL API.
 *
 * This function queries the `ordersCount` resource and returns count of orders.
 *
 * @param {Object} params - The input parameters.
 * @param {GraphQLClient} params.client - The authenticated Shopify Admin API client.
 * @returns {Promise<number>} A promise that resolves to number.
 *
 * @example
 * const ordersCount = await getOrdersCount({ client });
 * console.log(ordersCount);
 */
export const getOrdersCount = async ({
  client,
}: {
  client: GraphQLClient;
}): Promise<number> => {
  try {
    const response = await client.request(
      `query getOrdersCount($limit: Int) {
          ordersCount(limit: $limit) {
            count
          }
        }
      `,
      {
        variables: {
          limit: null,
        },
      },
    );

    const ordersCountData = response?.data as {
      ordersCount: {
        count: number;
      };
    };

    const ordersCount = ordersCountData?.ordersCount?.count ?? 0;

    return ordersCount;
  } catch (error) {
    console.error(error);
    return 0;
  }
};
