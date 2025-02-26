import type { MarketResponse, Market } from "~/@types/market";

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
