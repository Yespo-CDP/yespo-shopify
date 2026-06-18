import type { GraphQLClient } from "@shopify/graphql-client";

const PRODUCTS_PAGE_SIZE = 250;

/**
 * Fetches the total number of product variants in the Shopify store.
 */
export const getProductVariantsCount = async ({
  client,
}: {
  client: GraphQLClient;
}): Promise<number> => {
  try {
    let cursor: string | null = null;
    let totalVariantsCount = 0;

    do {
      const response = await client.request(
        `query getProductVariantsCount($count: Int, $cursor: String) {
          products(first: $count, after: $cursor) {
            nodes {
              variantsCount {
                count
              }
            }
            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }`,
        {
          variables: {
            count: PRODUCTS_PAGE_SIZE,
            cursor,
          },
        },
      );

      const productsData = response?.data as {
        products?: {
          nodes?: {
            variantsCount?: {
              count?: number;
            };
          }[];
          pageInfo?: {
            endCursor?: string;
            hasNextPage?: boolean;
          };
        };
      };

      const products = productsData?.products?.nodes ?? [];
      totalVariantsCount += products.reduce(
        (sum, product) => sum + (product.variantsCount?.count ?? 0),
        0,
      );

      const hasNextPage = productsData?.products?.pageInfo?.hasNextPage ?? false;
      cursor = hasNextPage
        ? (productsData?.products?.pageInfo?.endCursor ?? null)
        : null;
    } while (cursor);

    return totalVariantsCount;
  } catch (error) {
    console.error(error);
    return 0;
  }
};
