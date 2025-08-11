import type { GraphQLClient } from "@shopify/graphql-client";

/**
 * Fetches a count of customers from the Shopify store using the Admin GraphQL API.
 *
 * This function queries the `customersCount` resource and returns count of customers.
 *
 * @param {Object} params - The input parameters.
 * @param {GraphQLClient} params.client - The authenticated Shopify Admin API client.
 * @returns {Promise<number>} A promise that resolves to number.
 *
 * @example
 * const customersCount = await getCustomersCount({ client });
 * console.log(customersCount);
 */
export const getCustomersCount = async ({
  client,
}: {
  client: GraphQLClient;
}): Promise<number> => {
  try {
    const response = await client.request(
      `query getCustomersCount {
          customersCount {
            count
          }
        }
      `,
    );

    const customersCountData = response?.data as {
      customersCount: {
        count: number;
      };
    };

    const customersCount = customersCountData?.customersCount?.count ?? 0;

    return customersCount;
  } catch (error) {
    console.error(error);
    return 0;
  }
};
