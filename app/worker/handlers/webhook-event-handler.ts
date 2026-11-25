import { shopRepository } from "~/repositories/repositories.server";
import { createContactService } from "~/services/create-contact.server";
import { updateContactService } from "~/services/update-contact.service";
import { sendPurchasedItemsService } from "~/services/send-purchased-items.server";
import { isOrderDeleted } from "~/services/is-order-deleted.server";
import { updateOrderService } from "~/services/update-order.server";
import { sendStatusCartService } from "~/services/send-status-cart.server";
import { deleteOrderService } from "~/services/delete-order.server";
import type { OrderCreatePayload, OrderDeletePayload } from "~/@types/order";
import { enqueueWebhookEvent, type WebhookEventJobData } from "~/services/queue";

/**
 * Processes a customers, orders or carts webhook queued by its route.
 *
 * The shop is read again, so settings changed after the webhook arrived apply.
 *
 * - "CUSTOMERS_CREATE" / "CUSTOMERS_UPDATE": create or update the contact if
 *   `isContactSyncEnabled` is on.
 * - "ORDERS_CREATE": sends PurchasedItems if `isWebTrackingEnabled` is on. If the
 *   event was not sent (web tracking disabled, no cart token or tracking data,
 *   or sending failed) and `isOrderSyncEnabled` is on, queues the order as a
 *   separate "ORDERS_UPDATED" job, so its retries do not send PurchasedItems again.
 * - "ORDERS_UPDATED": creates or updates the order if `isOrderSyncEnabled` is on
 *   (`POST /orders` upserts by `externalOrderId`). An order Shopify no longer has
 *   is skipped: a late event must not create it in Yespo again. If that cannot be
 *   checked, the order is sent.
 * - "ORDERS_DELETE": deletes the order in Yespo and its `OrderSync` record if
 *   `isOrderSyncEnabled` is on.
 * - "CARTS_UPDATE": sends StatusCart if `isWebTrackingEnabled` is on.
 *
 * An error thrown by a service fails the job, so BullMQ retries it. PurchasedItems
 * and StatusCart errors are only logged and are not retried.
 */
export async function webhookEventHandler(
  data: WebhookEventJobData,
): Promise<void> {
  const { topic, payload } = data;
  const shop = await shopRepository.getShop(data.shop);
  if (!shop || !shop.apiKey) {
    return;
  }

  switch (topic) {
    case "CUSTOMERS_CREATE":
      if (!shop.isContactSyncEnabled) return;
      await createContactService(
        payload,
        shop.apiKey,
        shop.id,
        shop.domain || shop.shopUrl,
        shop.orgId,
        shop.shopUrl || data.shop,
      );
      break;

    case "CUSTOMERS_UPDATE":
      if (!shop.isContactSyncEnabled) return;
      await updateContactService(
        payload,
        shop.apiKey,
        shop.id,
        shop.domain || shop.shopUrl,
        shop.orgId,
        shop.shopUrl || data.shop,
      );
      break;

    case "ORDERS_CREATE": {
      const purchasedItemsSent = shop.isWebTrackingEnabled
        ? await sendPurchasedItemsService(payload, shop)
        : false;

      if (!purchasedItemsSent && shop.isOrderSyncEnabled) {
        await enqueueWebhookEvent(
          { shop: data.shop, topic: "ORDERS_UPDATED", payload },
          `order-create-${(payload as OrderCreatePayload).id}`,
        );
      }
      break;
    }

    case "ORDERS_UPDATED":
      if (shop?.isOrderSyncEnabled) {
        const { id, admin_graphql_api_id: orderGid } =
          payload as OrderCreatePayload;
        const shopUrl = shop.shopUrl || data.shop;
        if (await isOrderDeleted({ shopUrl, orderGid })) {
          console.log(
            `Order ${id} not found in Shopify, orders/updated skipped for ${shopUrl}`,
          );
          return;
        }

        await updateOrderService(
          payload as any,
          shop.apiKey,
          shop.id,
          shop.domain || data.shop,
          shop.orgId,
          shopUrl,
        );
      }
      break;

    case "ORDERS_DELETE":
      if (!shop.isOrderSyncEnabled) return;
      await deleteOrderService(String((payload as OrderDeletePayload).id), shop);
      break;

    case "CARTS_UPDATE":
      if (!shop.isWebTrackingEnabled) return;
      await sendStatusCartService(payload, shop);
      break;

    default:
      console.warn(`❌ Unhandled webhook topic: ${topic}`);
  }
}
