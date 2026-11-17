import { shopRepository } from "~/repositories/repositories.server";
import { createContactService } from "~/services/create-contact.server";
import { updateContactService } from "~/services/update-contact.service";
import { sendPurchasedItemsService } from "~/services/send-purchased-items.server";
import { updateOrderService } from "~/services/update-order.server";
import { sendStatusCartService } from "~/services/send-status-cart.server";
import type { WebhookEventJobData } from "~/services/queue";

/**
 * Processes a customers, orders or carts webhook queued by its route.
 *
 * The shop is read again, so settings changed after the webhook arrived apply.
 *
 * - "CUSTOMERS_CREATE" / "CUSTOMERS_UPDATE": create or update the contact if
 *   `isContactSyncEnabled` is on.
 * - "ORDERS_CREATE": sends PurchasedItems if `isWebTrackingEnabled` is on. If the
 *   event was not sent (web tracking disabled, no cart token or tracking data,
 *   or sending failed) and `isOrderSyncEnabled` is on, creates the order through
 *   `updateOrderService` (`POST /orders` upserts by `externalOrderId`).
 * - "ORDERS_UPDATED": updates the order if `isOrderSyncEnabled` is on.
 * - "CARTS_UPDATE": sends StatusCart if `isWebTrackingEnabled` is on.
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
        await updateOrderService(
          payload as any,
          shop.apiKey,
          shop.id,
          shop.domain || data.shop,
          shop.orgId,
          shop.shopUrl || data.shop,
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
          shop.domain || data.shop,
          shop.orgId,
          shop.shopUrl || data.shop,
        );
      }
      break;

    case "CARTS_UPDATE":
      if (!shop.isWebTrackingEnabled) return;
      await sendStatusCartService(payload, shop);
      break;

    default:
      console.warn(`❌ Unhandled webhook topic: ${topic}`);
  }
}
