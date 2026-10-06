import type { GraphQLClient } from "@shopify/graphql-client";
import type { ProductData, ProductsResponse } from "~/@types/product";

const VARIANTS_PAGE_SIZE = 100;

/** Active products published to the Online Store — shared by fetch and Total. */
export const PRODUCT_SYNC_SEARCH_QUERY =
  "status:active AND published_status:published";

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
      `query getProducts($count: Int, $cursor: String, $variantsCount: Int, $query: String) {
        shop {
          currencyCode
        }
        products(first: $count, after: $cursor, query: $query) {
          nodes {
            id
            title
            handle
            description
            vendor
            tags
            onlineStoreUrl
            featuredImage { url }
            collections(first: 10) {
              nodes { id title handle }
            }
            category {
              id
              name
              fullName
            }
            createdAt
            updatedAt
            variants(first: $variantsCount) {
              nodes {
                id
                title
                price
                compareAtPrice
                inventoryQuantity
                image { url }
                selectedOptions { name value }
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
          query: PRODUCT_SYNC_SEARCH_QUERY,
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

/**
 * Loads one product by GID with the same fields historical sync uses.
 * Returns null when Shopify has no such product. Throws on request errors
 * so the caller can retry.
 */
export const getProductById = async ({
  client,
  productId,
}: {
  client: GraphQLClient;
  productId: string;
}): Promise<{ product: ProductData | null; shopCurrency?: string }> => {
  const response = await client.request(
    `query getProductById($id: ID!, $variantsCount: Int) {
      shop {
        currencyCode
      }
      product(id: $id) {
        id
        title
        handle
        description
        vendor
        tags
        onlineStoreUrl
        featuredImage { url }
        collections(first: 10) {
          nodes { id title handle }
        }
        category {
          id
          name
          fullName
        }
        createdAt
        updatedAt
        variants(first: $variantsCount) {
          nodes {
            id
            title
            price
            compareAtPrice
            inventoryQuantity
            image { url }
            selectedOptions { name value }
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
    }`,
    {
      variables: {
        id: productId,
        variantsCount: VARIANTS_PAGE_SIZE,
      },
    },
  );

  const graphQLErrors = response?.errors?.graphQLErrors;
  if (
    (graphQLErrors && graphQLErrors.length > 0) ||
    response?.errors?.message
  ) {
    throw new Error(
      `Failed to fetch product ${productId}: ${JSON.stringify(response.errors)}`,
    );
  }

  const data = response?.data as {
    shop?: { currencyCode?: string };
    product?: ProductData | null;
  };

  return {
    product: data?.product ?? null,
    shopCurrency: data?.shop?.currencyCode,
  };
};
