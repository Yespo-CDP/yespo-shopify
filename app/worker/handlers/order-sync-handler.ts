import type { Order } from "~/@types/order";
import {
  orderSyncRepository,
  orderSyncLogRepository,
} from "~/repositories/repositories.server";
import { createOrders } from "~/api/create-orders";
import { createClient } from "../services/create-client";
import { getOrders } from "../services/get-orders";
import { getOrdersCount } from "../services/get-orders-count";
import { createOrderPayload } from "../services/create-order-payload";

const ORDERS_CHUNK_SIZE = 150; // Shopify max limit 250 (this does not include 100 lineItems in each orders)

/**
 * Syncs order list from Shopify with contact list in Yespo.
 *
 * This handler synchronizes all orders available in Shopify with Yespo contacts.
 * Synchronization occurs in a cycle with chunks of 150 pieces (`ORDERS_CHUNK_SIZE`).
 * Based on the `OrderSync` table in the database, we check the contacts that have
 * already been synchronized and filter them out.
 *
 *
 * @param {any} shop - The unique URL identifier of the shop.
 * @param {string} accessToken - Access token from shopify session.
 * @param {string} apiKey - The API key to connect with the account.
 * @param {string} shopId - The unique shop id in our database.
 *
 * @returns {Promise<void>} A promise that resolves once the synchronization has been complete or logs an error on failure.
 *
 * @example
 * await orderSyncHandler(
 *   shop,
 *   accessToken,
 *   shopData.apiKey,
 *   shopData.id
 * );
 */

export const orderSyncHandler = async (
  shop: string,
  accessToken: string,
  apiKey: string,
  shopId: number,
) => {
  const orderSyncLog = await orderSyncLogRepository.getOrderSyncLogByShop(shop);

  if (orderSyncLog?.status === "IN_PROGRESS") {
    console.log(`⚠️ Synchronization already running for ${shop}`);
    return;
  }

  console.log(`⏳ Synchronizing orders start for ${shop}`);
  console.log("shop", shop);
  console.log("accessToken", accessToken);

  const client = createClient({ shop, accessToken });
  const ordersCount = await getOrdersCount({ client });
  console.log("Total orders count", ordersCount, "\n");

  await orderSyncLogRepository.createOrUpdateOrderSyncLog({
    status: "IN_PROGRESS",
    skippedCount: 0,
    syncedCount: 0,
    failedCount: 0,
    totalCount: ordersCount,
    shop: {
      connect: {
        id: shopId,
      },
    },
  });

  let cursor: string | null | undefined = null;
  let totalSkippedCount = 0;
  let totalFailedCount = 0;
  let totalSyncedCount = 0;

  try {
    do {
      try {
        console.log("\n", "Chunk start:");
        const response = await getOrders({
          client,
          count: ORDERS_CHUNK_SIZE,
          cursor,
        });
        const orders = response.orders;
        cursor = response.cursor;

        const orderIds = orders.map((order) => order.id);
        const orderSyncs =
          await orderSyncRepository.getOrderSyncByOrderIds(orderIds);

        const ordersData: Order[] = [];

        let chunkSkippedCount = 0;
        let chunkFailedCount = 0;

        for (const order of orders) {
          const orderSync = orderSyncs.find((val) => val.orderId === order.id);

          const orderUpdatedDate = new Date(order.updatedAt)?.getTime() ?? 0;
          const orderSyncUpdatedDate = orderSync?.updatedAt?.getTime() ?? 0;

          if (orderUpdatedDate > orderSyncUpdatedDate) {
            const orderData = createOrderPayload(order);
            ordersData.push(orderData);

            await orderSyncRepository.createOrUpdateOrderSync({
              orderId: order.id,
              createdAt: order.createdAt,
              updatedAt: order.updatedAt,
              shop: {
                connect: {
                  id: shopId,
                },
              },
            });
          } else {
            chunkSkippedCount++;
          }
        }

        if (ordersData?.length > 0) {
          const contactsUpdateResponse = await createOrders({
            apiKey,
            orders: ordersData,
          });

          if (contactsUpdateResponse?.failedOrders) {
            if (Array.isArray(contactsUpdateResponse?.failedOrders)) {
              chunkFailedCount = contactsUpdateResponse?.failedOrders?.length;
            } else {
              chunkFailedCount = 1;
            }
          }
        }

        totalFailedCount += chunkFailedCount;
        totalSkippedCount += chunkSkippedCount;
        totalSyncedCount += ordersData?.length - chunkFailedCount;

        console.log("Total orders in chunk:", orders?.length);
        console.log("Total skipped orders in chunk:", chunkSkippedCount);
        console.log("Total sent orders to sync:", ordersData?.length);
        console.log("Total failed orders sync:", chunkFailedCount);

        await orderSyncLogRepository.createOrUpdateOrderSyncLog({
          skippedCount: totalSkippedCount,
          failedCount: totalFailedCount,
          syncedCount: totalSyncedCount,
          totalCount: ordersCount,
          shop: {
            connect: {
              id: shopId,
            },
          },
        });
      } catch {
        console.error("Error orders sync in chunk");
        await orderSyncLogRepository.createOrUpdateOrderSyncLog({
          status: "ERROR",
          shop: {
            connect: {
              id: shopId,
            },
          },
        });
        cursor = null;
      }
    } while (cursor);

    await orderSyncLogRepository.createOrUpdateOrderSyncLog({
      status: "COMPLETE",
      skippedCount: totalSkippedCount,
      failedCount: totalFailedCount,
      syncedCount: totalSyncedCount,
      totalCount: ordersCount,
      shop: {
        connect: {
          id: shopId,
        },
      },
    });

    console.log(`✅ Synchronizing orders finish for ${shop}`);
  } catch (error) {
    console.error("Synchronization error", error);
    await orderSyncLogRepository.createOrUpdateOrderSyncLog({
      status: "ERROR",
      skippedCount: totalSkippedCount,
      failedCount: totalFailedCount,
      syncedCount: totalSyncedCount,
      totalCount: ordersCount,
      shop: {
        connect: {
          id: shopId,
        },
      },
    });
    return;
  }
};
