import type { MarketResponse, Market } from "~/@types/market";

/**
 * Fetches a list of markets from the Shopify store using the Admin GraphQL API.
 *
 * This function queries the `markets` resource and returns the first `count` markets
 * (default is 5). Each market includes basic information such as ID, name, handle, and status.
 *
 * @param {Object} params - The input parameters.
 * @param {any} params.admin - The authenticated Shopify Admin API client.
 * @param {number} [params.count=5] - The number of markets to fetch.
 *
 * @returns {Promise<Market[]>} A promise that resolves to an array of `Market` objects, or an empty array if the query fails.
 *
 * @example
 * const markets = await getMarkets({ admin, count: 10 });
 * console.log(markets);
 */
const getMarkets = async ({
  admin,
  count = 5,
}: {
  admin: any;
  count?: number;
}): Promise<Market[]> => {
  try {
    const response = await admin.graphql(`
      #graphql
      query getMarkets($count: Int) {
        markets(first: $count) {
          nodes {
            id
            name
            handle
            enabled
          }
        }
      }
    `,
      {
        variables: {
          count,
        },
      },
    );

    const responseParse = await response.json();
    const marketsData = responseParse?.data as MarketResponse;
    const markets = marketsData?.markets?.nodes;

    return markets ?? [];
  } catch (error) {
    console.error(error);
    return [];
  }
};

export default getMarkets;
