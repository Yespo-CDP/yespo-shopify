import type { GraphQLClient } from "@shopify/graphql-client";
import type { YespoCategory } from "~/@types/productVariant";

interface CollectionsResponse {
  product: {
    collections: {
      nodes: Array<{ id: string; title: string; handle: string }>;
    };
  } | null;
}

/**
 * Fetches Shopify collections for a product and maps them to Yespo category objects.
 *
 * Used in webhook flows where the product payload does not include collection data.
 * Falls back to an empty array on error so the webhook processing is not blocked.
 *
 * @param client - Shopify GraphQL Admin API client
 * @param productGid - Shopify product GID, e.g. "gid://shopify/Product/123"
 * @returns Array of YespoCategory objects ready for the product payload
 */
export const getProductCollections = async ({
  client,
  productGid,
}: {
  client: GraphQLClient;
  productGid: string;
}): Promise<YespoCategory[]> => {
  try {
    const response = await client.request(
      `query getProductCollections($id: ID!) {
        product(id: $id) {
          collections(first: 10) {
            nodes { id title handle }
          }
        }
      }`,
      { variables: { id: productGid } },
    );

    const nodes =
      (response?.data as CollectionsResponse)?.product?.collections?.nodes ??
      [];

    return nodes.map((node) => ({
      id: node.id.split("/").pop() ?? node.id,
      name: node.title,
      type: "collection" as const,
    }));
  } catch (error) {
    console.error("Failed to fetch product collections", error);
    return [];
  }
};
