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
 * Fetches the GIDs of ALL variants for a product, following pagination.
 *
 * Unlike a PRODUCTS_UPDATE webhook payload (which truncates the `variants`
 * array to 100 items), this returns the complete current variant set. Used to
 * reliably detect variants that were genuinely removed in Shopify.
 *
 * @returns Full list of variant GIDs, or `null` if the lookup failed (so callers
 *          can skip destructive cleanup instead of assuming everything is gone).
 */
export const fetchAllProductVariantGids = async ({
  client,
  productId,
}: {
  client: GraphQLClient;
  productId: string;
}): Promise<string[] | null> => {
  try {
    const gids: string[] = [];
    let cursor: string | null = null;

    do {
      const response: { data?: ProductVariantsResponse } =
        await client.request(
          `query getProductVariantGids($productId: ID!, $count: Int, $cursor: String) {
          product(id: $productId) {
            variants(first: $count, after: $cursor) {
              nodes { id }
              pageInfo { endCursor hasNextPage }
            }
          }
        }`,
          {
            variables: { productId, count: VARIANTS_PAGE_SIZE, cursor },
          },
        );

      const variantsConnection = response?.data?.product?.variants;
      for (const node of variantsConnection?.nodes ?? []) {
        if (node?.id) gids.push(node.id);
      }
      cursor = variantsConnection?.pageInfo?.hasNextPage
        ? (variantsConnection.pageInfo.endCursor ?? null)
        : null;
    } while (cursor);

    return gids;
  } catch (error) {
    console.error("Failed to fetch all product variant GIDs", error);
    return null;
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
