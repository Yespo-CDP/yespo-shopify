import { getOfflineAccessToken } from "~/services/get-offline-session.server";
import { createClient } from "~/worker/services/create-client";
import { buildOrderItemLink } from "~/services/build-order-item-link";

/**
 * Shopify Admin API rejects input arrays larger than 250, including `nodes(ids:)`.
 * @see https://shopify.dev/docs/api/usage/limits#input-limits
 */
const VARIANT_IDS_BATCH_SIZE = 250;

const ORDER_ITEM_VARIANTS_QUERY = `query orderItemVariants($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on ProductVariant {
      id
      image { url }
      product {
        handle
        onlineStoreUrl
        featuredImage { url }
      }
    }
  }
}`;

interface VariantNode {
  id?: string;
  image?: { url?: string | null } | null;
  product?: {
    handle?: string | null;
    onlineStoreUrl?: string | null;
    featuredImage?: { url?: string | null } | null;
  } | null;
}

export interface OrderItemProductLink {
  url: string;
  imageUrl: string;
}

/**
 * Loads storefront URL and image for order line-item variants.
 * Keyed by the numeric Shopify variant id.
 */
export async function getOrderItemProducts({
  shopUrl,
  shopDomain,
  variantIds,
}: {
  shopUrl: string;
  shopDomain: string;
  variantIds: string[];
}): Promise<Map<string, OrderItemProductLink>> {
  const links = new Map<string, OrderItemProductLink>();
  const uniqueIds = [...new Set(variantIds.filter(Boolean))];
  if (!shopUrl || uniqueIds.length === 0) return links;

  const accessToken = await getOfflineAccessToken(shopUrl);
  if (!accessToken) return links;

  const client = createClient({ shop: shopUrl, accessToken });

  for (
    let offset = 0;
    offset < uniqueIds.length;
    offset += VARIANT_IDS_BATCH_SIZE
  ) {
    const batch = uniqueIds.slice(offset, offset + VARIANT_IDS_BATCH_SIZE);
    const response = await client.request(ORDER_ITEM_VARIANTS_QUERY, {
      variables: {
        ids: batch.map((id) => `gid://shopify/ProductVariant/${id}`),
      },
    });

    const nodes = (response?.data as { nodes?: Array<VariantNode | null> })
      ?.nodes;

    for (const node of nodes ?? []) {
      const variantId = node?.id?.split("/").pop();
      if (!variantId) continue;

      links.set(
        variantId,
        buildOrderItemLink({
          variantId,
          shopDomain,
          handle: node?.product?.handle,
          onlineStoreUrl: node?.product?.onlineStoreUrl,
          variantImageUrl: node?.image?.url,
          featuredImageUrl: node?.product?.featuredImage?.url,
        }),
      );
    }
  }

  return links;
}
