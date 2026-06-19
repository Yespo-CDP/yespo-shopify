import { Queue } from "bullmq";

import { redisConfig } from "~/config/redis";
import {
  customerSyncLogRepository,
  marketSyncLogRepository,
  orderSyncLogRepository,
  productVariantSyncLogRepository,
  shopRepository,
} from "~/repositories/repositories.server";
import type { Shop } from "~/@types/shop";
import type { Session } from "@shopify/shopify-app-react-router/server";
import { getOfflineAccessToken } from "~/services/get-offline-session.server";

export const DataSyncQueue = new Queue("data-sync", {
  connection: redisConfig,
});

export const DataSyncMarketQueue = new Queue("data-sync-market", {
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
  const productVariantSyncLog =
    await productVariantSyncLogRepository.getProductVariantSyncLogByShop(
      session.shop,
    );

  if (
    customerSyncLog?.status !== "IN_PROGRESS" &&
    orderSyncLog?.status !== "IN_PROGRESS" &&
    productVariantSyncLog?.status !== "IN_PROGRESS"
  ) {
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
    await productVariantSyncLogRepository.createOrUpdateProductVariantSyncLog({
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
      { ...session },
      {
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );
  }
}

async function enqueueMarketSyncJobIfEligible(shop: Shop): Promise<boolean> {
  if (!shop.apiKey) {
    console.error(`Market sync: Api key not found for ${shop.shopUrl}`);
    return false;
  }

  const marketSyncLog = await marketSyncLogRepository.hasInProgressByShop(
    shop.shopUrl,
  );
  if (marketSyncLog) {
    return false;
  }

  const accessToken = await getOfflineAccessToken(shop.shopUrl);
  if (!accessToken) {
    console.error(`Market sync: no offline session for ${shop.shopUrl}`);
    return false;
  }

  await DataSyncMarketQueue.add(
    "data-sync-market",
    {
      shop: shop.shopUrl,
      accessToken,
    },
    {
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  );

  return true;
}

export async function enqueueMarketSyncTaskForShopUrl(
  shopUrl: string,
): Promise<number> {
  const shop = await shopRepository.getShop(shopUrl);
  if (!shop) {
    return 0;
  }

  return (await enqueueMarketSyncJobIfEligible(shop)) ? 1 : 0;
}

export async function enqueueMarketSyncTasks(): Promise<number> {
  const shops = await shopRepository.getShopsForMarketSync();
  let enqueued = 0;

  for (const shop of shops) {
    if (await enqueueMarketSyncJobIfEligible(shop)) {
      enqueued++;
    }
  }

  return enqueued;
}
