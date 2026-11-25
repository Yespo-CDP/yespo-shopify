import { createOfflineTokenManager } from "~/worker/services/offline-token-manager";
import { createClient } from "~/worker/services/create-client";

const ORDER_EXISTS_QUERY = `query orderExists($id: ID!) {
  order(id: $id) { id }
}`;

/**
 * Tells whether the order no longer exists in Shopify.
 *
 * True only when Shopify answers `order: null` without errors: a failed request
 * can return `order: null` too. When the check fails, returns false, so the
 * caller handles the order as existing. Never throws.
 *
 * @param shopUrl - myshopify domain
 * @param orderGid - order GID (`admin_graphql_api_id` of the webhook payload)
 */
export async function isOrderDeleted({
  shopUrl,
  orderGid,
}: {
  shopUrl: string;
  orderGid?: string | null;
}): Promise<boolean> {
  try {
    if (!orderGid) throw new Error("no order id");

    const tokenManager = createOfflineTokenManager(shopUrl);
    const accessToken = await tokenManager.getAccessToken();
    // A missing session is already logged by `getOfflineAccessToken`.
    if (!accessToken) return false;

    const client = createClient({ shop: shopUrl, accessToken, tokenManager });
    const response = await client.request(ORDER_EXISTS_QUERY, {
      variables: { id: orderGid },
    });

    // The client returns errors instead of throwing them. `JSON.stringify` drops
    // the raw `Response` (headers, body) the client keeps in `errors`.
    if (response.errors) throw new Error(JSON.stringify(response.errors));

    const order = (response.data as { order?: { id: string } | null })?.order;
    if (order === undefined) throw new Error("no order in the response");

    return order === null;
  } catch (error) {
    console.error(
      `Failed to check order ${orderGid} in Shopify for ${shopUrl}:`,
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}
