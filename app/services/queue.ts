import { Queue } from "bullmq";

import { redisConfig } from "~/config/redis";
import {
  customerSyncLogRepository,
  orderSyncLogRepository,
} from "~/repositories/repositories.server";
import type { Shop } from "~/@types/shop";
import type { Session } from "@shopify/shopify-app-remix/server";

export const DataSyncQueue = new Queue("data-sync", {
  connection: redisConfig,
});

export async function enqueueDataSyncTasks({
  session,
  shop,
}: {
  session: Session;
  shop: Shop;
}) {
  console.log("Enqueueing data sync tasks...", session);
  const customerSyncLog =
    await customerSyncLogRepository.getCustomerSyncLogByShop(session.shop);
  const orderSyncLog = await orderSyncLogRepository.getOrderSyncLogByShop(
    session.shop,
  );

  if (customerSyncLog?.status !== "IN_PROGRESS") {
    await customerSyncLogRepository.createOrUpdateCustomerSyncLog({
      status: "IN_PROGRESS",
      skippedCount: 0,
      syncedCount: 0,
      failedCount: 0,
      totalCount: 0,
      shop: {
        connect: {
          id: shop.id,
        },
      },
    });

    await DataSyncQueue.add(
      "data-sync",
      { ...session, type: "customer" },
      {
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );
  }

  if (orderSyncLog?.status !== "IN_PROGRESS") {
    await orderSyncLogRepository.createOrUpdateOrderSyncLog({
      status: "IN_PROGRESS",
      skippedCount: 0,
      syncedCount: 0,
      failedCount: 0,
      totalCount: 0,
      shop: {
        connect: {
          id: shop.id,
        },
      },
    });

    await DataSyncQueue.add(
      "data-sync",
      { ...session, type: "order" },
      {
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );
  }
}
