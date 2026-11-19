import { deleteYespoOrder } from "~/api/delete-orders";
import { orderSyncRepository } from "~/repositories/repositories.server";
import type { Shop } from "~/@types/shop";

/**
 * Deletes an order deleted in Shopify from Yespo and from the order sync records.
 *
 * Yespo goes first: if it fails, the error is thrown so the job is retried,
 * and the `OrderSync` record is still there.
 *
 * @param {string} orderId - Shopify order ID (numeric, as sent to Yespo as `externalOrderId`).
 * @param {Shop} shop - The shop with a Yespo API key.
 * @returns {Promise<void>} Resolves when both deletions are done.
 */
export const deleteOrderService = async (orderId: string, shop: Shop) => {
  await deleteYespoOrder({
    apiKey: shop.apiKey!,
    externalOrderId: orderId,
    domain: shop.domain || shop.shopUrl,
    orgId: shop.orgId,
  });
  await orderSyncRepository.deleteOrderSync(
    shop.id,
    `gid://shopify/Order/${orderId}`,
  );
};
