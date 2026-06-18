import type { GraphQLClient } from "@shopify/graphql-client";
import type { ProductData, ProductsResponse } from "~/@types/product";

const VARIANTS_PAGE_SIZE = 100;

/**
 * Fetches a paginated list of products with the first page of variants from Shopify.
 */
export const getProducts = async ({
  client,
  count = 1,
  cursor = null,
}: {
  client: GraphQLClient;
  count?: number;
  cursor?: string | null;
}): Promise<{
  products: ProductData[];
  cursor?: string | null;
  shopCurrency?: string;
}> => {
  try {
    const response = await client.request(
      `query getProducts($count: Int, $cursor: String, $variantsCount: Int) {
        shop {
          currencyCode
        }
        products(first: $count, after: $cursor) {
          nodes {
            id
            title
            description
            createdAt
            updatedAt
            variants(first: $variantsCount) {
              nodes {
                id
                title
                price
                contextualPricing(context: {}) {
                  price {
                    amount
                    currencyCode
                  }
                }
                createdAt
                updatedAt
              }
              pageInfo {
                endCursor
                hasNextPage
              }
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
          count,
          cursor,
          variantsCount: VARIANTS_PAGE_SIZE,
        },
      },
    );

    const productsData = response?.data as ProductsResponse;
    const products = productsData?.products?.nodes;
    const endCursor = productsData?.products?.pageInfo?.endCursor;
    const hasNextPage = productsData?.products?.pageInfo?.hasNextPage;
    const shopCurrency = productsData?.shop?.currencyCode;

    return {
      products: products ?? [],
      cursor: hasNextPage ? endCursor : null,
      shopCurrency,
    };
  } catch (error) {
    console.error(error);
    return { products: [], cursor: null };
  }
};
