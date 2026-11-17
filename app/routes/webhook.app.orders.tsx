import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "~/shopify.server";
import { shopRepository } from "~/repositories/repositories.server";
import { sendPurchasedItemsService } from "~/services/send-purchased-items.server";
import { updateOrderService } from "~/services/update-order.server";

/**
 * Handles incoming Shopify webhooks, authenticates the request, and processes events based on topic.
 *
 * Supports the "ORDERS_CREATE" webhook topic by forwarding the payload to the purchased items service.
 * Silently ignores requests with no valid session or shops without an API key.
 * Sends PurchasedItems event to Yespo web tracker if option `isWebTrackingEnabled` is enabled.
 * Create or update order in Yespo if option `isOrderSyncEnabled` is enabled.
 * Returns HTTP 400 for unhandled webhook topics.
 *
 * Supported webhook topics:
 * - "ORDERS_CREATE": Calls `sendPurchasedItemsService` if `isWebTrackingEnabled` is on. If the
 *   PurchasedItems event was not sent (web tracking disabled, no cart token or tracking data, or sending
 *   failed) and `isOrderSyncEnabled` is on, creates the order through `updateOrderService`
 *   (`POST /orders` upserts by `externalOrderId`).
 * - "ORDERS_UPDATED": Calls `updateOrderService` with payload and shop API key.
 *
 * @async
 * @function action
 * @param {ActionFunctionArgs} args - Remix action function arguments containing the HTTP request.
 * @param {Request} args.request - The incoming HTTP request representing the webhook.
 * @returns {Promise<Response>} A response indicating the result of processing the webhook.
 *
 * @example
 * // Typical webhook request processing flow:
 * await action({ request });
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, session, payload, webhookId } =
    await authenticate.webhook(request);

  if (!session) {
    return new Response("Success", { status: 200 });
  }
  console.log(
    `Received ${topic} webhook for ${session.shop} webhookId ${webhookId}`,
  );

  const shop = await shopRepository.getShop(session.shop);
  if (!shop || !shop?.apiKey) {
    return new Response("Success", { status: 200 });
  }

  switch (topic) {
    case "ORDERS_CREATE": {
      const purchasedItemsSent = shop.isWebTrackingEnabled
        ? await sendPurchasedItemsService(payload, shop)
        : false;

      if (!purchasedItemsSent && shop.isOrderSyncEnabled) {
        await updateOrderService(
          payload as any,
          shop.apiKey,
          shop.id,
          shop.domain || session.shop,
          shop.orgId,
          shop.shopUrl || session.shop,
        );
      }
      break;
    }

    case "ORDERS_UPDATED":
      if (shop?.isOrderSyncEnabled) {
        await updateOrderService(
          payload as any,
          shop.apiKey,
          shop.id,
          shop.domain || session.shop,
          shop.orgId,
          shop.shopUrl || session.shop,
        );
      }
      break;

    default:
      console.warn(`❌ Unhandled webhook topic: ${topic}`);
      return new Response(`Unhandled webhook topic: ${topic}`, { status: 200 });
  }

  return new Response("Success", { status: 200 });
};
