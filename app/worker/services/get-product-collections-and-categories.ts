import type { GraphQLClient } from "@shopify/graphql-client";
import type { YespoCategory } from "~/@types/productVariant";
import { mapShopifyCategories } from "~/worker/services/map-yespo-categories";

interface CollectionsAndCategoryResponse {
  product: {
    collections: {
      nodes: Array<{ id: string; title: string; handle: string }>;
    };
    category: {
      id: string;
      name: string;
      fullName: string;
    } | null;
  } | null;
}

/**
 * Fetches a product's Shopify collections AND its standard taxonomy category,
 * mapping both to Yespo category objects.
 *
 * - Collections → flat Yespo categories with `type: "collection"`.
 * - Taxonomy category → hierarchical Yespo category with `type: "category"`.
 *   The `path` is derived from Shopify's `fullName` (the breadcrumb), e.g.
 *   "Apparel > Clothing > Tops" → ["Apparel", "Clothing", "Tops"].
 *   Note: `TaxonomyCategory` exposes `ancestorIds`/`fullName`, not nested
 *   `ancestors { name }`, so `fullName` is the source for the path.
 *
 * Used in webhook flows where the product payload does not include this data.
 * Falls back to an empty array on error so webhook processing is not blocked.
 *
 * @param client - Shopify GraphQL Admin API client
 * @param productGid - Shopify product GID, e.g. "gid://shopify/Product/123"
 * @returns Array of YespoCategory objects ready for the product payload
 */
export const getProductCollectionsAndCategories = async ({
  client,
  productGid,
}: {
  client: GraphQLClient;
  productGid: string;
}): Promise<YespoCategory[]> => {
  try {
    const response = await client.request(
      `query getProductCollectionsAndCategories($id: ID!) {
        product(id: $id) {
          collections(first: 10) {
            nodes { id title handle }
          }
          category {
            id
            name
            fullName
          }
        }
      }`,
      { variables: { id: productGid } },
    );

    const product = (response?.data as CollectionsAndCategoryResponse)?.product;

    return mapShopifyCategories({
      collections: product?.collections?.nodes,
      category: product?.category,
    });
  } catch (error) {
    console.error(
      "Failed to fetch product collections and categories",
      error,
    );
    return [];
  }
};
