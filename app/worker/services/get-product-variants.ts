import type { GraphQLClient } from "@shopify/graphql-client";
import type {
  ProductData,
  ProductVariantData,
  ProductVariantsResponse,
} from "~/@types/product";

const VARIANTS_PAGE_SIZE = 100;

/**
 * Fetches the next page of variants for a product.
 */
export const getProductVariants = async ({
  client,
  productId,
  cursor = null,
}: {
  client: GraphQLClient;
  productId: string;
  cursor?: string | null;
}): Promise<{ variants: ProductVariantData[]; cursor?: string | null }> => {
  try {
    const response = await client.request(
      `query getProductVariants($productId: ID!, $count: Int, $cursor: String) {
        product(id: $productId) {
          variants(first: $count, after: $cursor) {
            nodes {
              id
              title
              price
              compareAtPrice
              inventoryQuantity
              image { url }
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
          productId,
          count: VARIANTS_PAGE_SIZE,
          cursor,
        },
      },
    );

    const variantsData = response?.data as ProductVariantsResponse;
    const variants = variantsData?.product?.variants?.nodes ?? [];
    const endCursor = variantsData?.product?.variants?.pageInfo?.endCursor;
    const hasNextPage =
      variantsData?.product?.variants?.pageInfo?.hasNextPage ?? false;

    return {
      variants,
      cursor: hasNextPage ? endCursor : null,
    };
  } catch (error) {
    console.error(error);
    return { variants: [], cursor: null };
  }
};

/**
 * Collects all variants for a product, including additional pages beyond the first query.
 */
export const fetchAllProductVariants = async ({
  client,
  product,
}: {
  client: GraphQLClient;
  product: ProductData;
}): Promise<ProductVariantData[]> => {
  const variants = [...(product.variants?.nodes ?? [])];
  let cursor = product.variants?.pageInfo?.hasNextPage
    ? product.variants.pageInfo.endCursor
    : null;

  while (cursor) {
    const response = await getProductVariants({
      client,
      productId: product.id,
      cursor,
    });

    variants.push(...response.variants);
    cursor = response.cursor ?? null;
  }
  return variants;
};
