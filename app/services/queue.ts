import { Queue } from "bullmq";

import { redisConfig } from "~/config/redis";
import {
  MARKET_SYNC_MAX_CONCURRENT_SHOPS,
  MARKET_SYNC_MIN_INTERVAL_MS,
  MARKET_SYNC_STALE_AFTER_MS,
} from "~/config/constants";
import {
  customerSyncLogRepository,
  marketSyncLogRepository,
  orderSyncLogRepository,
  productVariantSyncLogRepository,
  shopRepository,
} from "~/repositories/repositories.server";
import type { Shop, ShopWithMarketSyncLogs } from "~/@types/shop";
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

  // Re-check right before enqueuing, ignoring stale IN_PROGRESS rows so a
  // crashed/restarted worker doesn't block the shop forever.
  const staleBefore = new Date(Date.now() - MARKET_SYNC_STALE_AFTER_MS);
  const inProgress = await marketSyncLogRepository.hasFreshInProgressByShop(
    shop.shopUrl,
    staleBefore,
  );
  if (inProgress) {
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

/**
 * Whether a shop currently counts as "in progress": it has at least one
 * MarketSyncLog with status IN_PROGRESS whose updatedAt is fresh (>= staleBefore).
 */
function isFreshInProgress(
  shop: ShopWithMarketSyncLogs,
  staleBefore: Date,
): boolean {
  return shop.marketSyncLogs.some(
    (log) =>
      log.status === "IN_PROGRESS" &&
      log.updatedAt != null &&
      log.updatedAt >= staleBefore,
  );
}

/**
 * The shop's most recent market sync time = max(updatedAt) across its logs, or
 * null when it has never synced (highest priority to pick up).
 */
function lastSyncedAt(shop: ShopWithMarketSyncLogs): Date | null {
  let latest: Date | null = null;
  for (const log of shop.marketSyncLogs) {
    if (log.updatedAt && (latest === null || log.updatedAt > latest)) {
      latest = log.updatedAt;
    }
  }
  return latest;
}

/**
 * The shop's most recent successful market sync time = max(updatedAt) across its
 * COMPLETE logs, or null when it has never completed one. Used to throttle the
 * cron so a shop is not re-synced more than once per MARKET_SYNC_MIN_INTERVAL_MS.
 * Logs ending in ERROR are intentionally ignored so failures can retry sooner.
 */
function lastCompletedAt(shop: ShopWithMarketSyncLogs): Date | null {
  let latest: Date | null = null;
  for (const log of shop.marketSyncLogs) {
    if (
      log.status === "COMPLETE" &&
      log.updatedAt &&
      (latest === null || log.updatedAt > latest)
    ) {
      latest = log.updatedAt;
    }
  }
  return latest;
}

/**
 * Hourly cron entrypoint: enqueues market sync jobs while keeping at most
 * MARKET_SYNC_MAX_CONCURRENT_SHOPS shops in progress at once.
 *
 * Counts shops already syncing (fresh IN_PROGRESS), then enqueues up to the
 * remaining budget, preferring shops that synced longest ago (never-synced
 * shops first, then oldest updatedAt).
 *
 * Shops whose last successful (COMPLETE) sync finished less than
 * MARKET_SYNC_MIN_INTERVAL_MS ago are skipped so a shop is not re-synced every
 * hour. Never-synced shops and shops whose last sync ended in ERROR are not
 * throttled. This interval applies only to this cron path; manual/dashboard and
 * post data-sync triggers (enqueueMarketSyncTaskForShopUrl) bypass it.
 */
export async function enqueueMarketSyncTasks(): Promise<number> {
  const staleBefore = new Date(Date.now() - MARKET_SYNC_STALE_AFTER_MS);
  const minIntervalBefore = new Date(Date.now() - MARKET_SYNC_MIN_INTERVAL_MS);
  const shops = await shopRepository.getShopsForMarketSync();

  const inProgressCount = shops.filter((shop) =>
    isFreshInProgress(shop, staleBefore),
  ).length;

  const budget = MARKET_SYNC_MAX_CONCURRENT_SHOPS - inProgressCount;
  if (budget <= 0) {
    return 0;
  }

  const candidates = shops
    .filter((shop) => !isFreshInProgress(shop, staleBefore))
    .filter((shop) => {
      const completedAt = lastCompletedAt(shop);
      return completedAt === null || completedAt < minIntervalBefore;
    })
    .map((shop) => ({ shop, lastSyncedAt: lastSyncedAt(shop) }))
    .sort((a, b) => {
      // Never-synced shops (null) come first, then oldest updatedAt first.
      if (a.lastSyncedAt === null && b.lastSyncedAt === null) return 0;
      if (a.lastSyncedAt === null) return -1;
      if (b.lastSyncedAt === null) return 1;
      return a.lastSyncedAt.getTime() - b.lastSyncedAt.getTime();
    })
    .slice(0, budget);

  let enqueued = 0;
  for (const { shop } of candidates) {
    if (await enqueueMarketSyncJobIfEligible(shop)) {
      enqueued++;
    }
  }

  return enqueued;
}
