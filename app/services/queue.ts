import { Queue } from "bullmq";

import { redisConfig } from "~/config/redis";
import {
  DB_CLEANER_CRON_PATTERN,
  MARKET_SYNC_CRON_PATTERN,
  MARKET_SYNC_MAX_CONCURRENT_SHOPS,
  MARKET_SYNC_MIN_INTERVAL_MS,
  MARKET_SYNC_STALE_AFTER_MS,
  PRODUCT_WEBHOOK_DEBOUNCE_MS,
  PRODUCT_WEBHOOK_JOB_ATTEMPTS,
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

export const DataSyncQueue = new Queue("data-sync", {
  connection: redisConfig,
});

export const DataSyncMarketQueue = new Queue("data-sync-market", {
  connection: redisConfig,
});

export const CronQueue = new Queue("cron-jobs", {
  connection: redisConfig,
});

export const TokenMigrationQueue = new Queue("token-migration", {
  connection: redisConfig,
});

export const PRODUCT_WEBHOOK_QUEUE_NAME = "product-webhooks";
export const PRODUCT_WEBHOOK_JOB_NAME = "product-webhook";

export const ProductWebhookQueue = new Queue(PRODUCT_WEBHOOK_QUEUE_NAME, {
  connection: redisConfig,
});

export type ProductWebhookTopic =
  "PRODUCTS_CREATE" | "PRODUCTS_UPDATE" | "PRODUCTS_DELETE";

export interface ProductWebhookJobData {
  shop: string;
  shopId: number;
  topic: ProductWebhookTopic;
  productGid: string;
}

export const MARKET_SYNC_CRON_JOB_NAME = "market-sync-tick";
export const DB_CLEANER_CRON_JOB_NAME = "db-cleaner-tick";
export const TOKEN_MIGRATION_JOB_NAME = "migrate-token";

/**
 * One-time migration entrypoint: enqueues a token-migration job per shop so the
 * worker can exchange each shop's non-expiring offline token for an expiring one
 * (see migrate-offline-token.server.ts). Safe to run multiple times — jobs are
 * deduplicated by jobId and the migration itself is idempotent.
 */
export async function enqueueTokenMigration(): Promise<number> {
  const shops = await shopRepository.getAllShops();

  for (const shop of shops) {
    await TokenMigrationQueue.add(
      TOKEN_MIGRATION_JOB_NAME,
      { shop: shop.shopUrl },
      {
        jobId: `migrate-token-${shop.shopUrl}`,
        attempts: 5,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );
  }

  return shops.length;
}

/**
 * Registers the daily market-sync scheduler in Redis. Safe to call on every
 * worker startup — BullMQ upserts the scheduler by id.
 */
export async function registerMarketSyncCron(): Promise<void> {
  await CronQueue.upsertJobScheduler(
    MARKET_SYNC_CRON_JOB_NAME,
    { pattern: MARKET_SYNC_CRON_PATTERN },
    {
      name: MARKET_SYNC_CRON_JOB_NAME,
      data: {},
      opts: {
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    },
  );
}

/**
 * Registers the daily EventData TTL cleanup scheduler in Redis. Safe to call
 * on every worker startup — BullMQ upserts the scheduler by id.
 */
export async function registerDbCleanerCron(): Promise<void> {
  await CronQueue.upsertJobScheduler(
    DB_CLEANER_CRON_JOB_NAME,
    { pattern: DB_CLEANER_CRON_PATTERN },
    {
      name: DB_CLEANER_CRON_JOB_NAME,
      data: {},
      opts: {
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    },
  );
}

export type DataSyncKind = "customer" | "order" | "product";

export async function enqueueDataSyncTasks({
  session,
  shop,
  kinds,
}: {
  session: Session;
  shop: Shop;
  kinds: DataSyncKind[];
}) {
  console.log("Enqueueing data sync tasks...", session, kinds);

  const syncCustomers = kinds.includes("customer");
  const syncOrders = kinds.includes("order");
  const syncProducts = kinds.includes("product");

  if (!syncCustomers && !syncOrders && !syncProducts) {
    return;
  }

  const [customerSyncLog, orderSyncLog, productVariantSyncLog] =
    await Promise.all([
      syncCustomers
        ? customerSyncLogRepository.getCustomerSyncLogByShop(session.shop)
        : Promise.resolve(null),
      syncOrders
        ? orderSyncLogRepository.getOrderSyncLogByShop(session.shop)
        : Promise.resolve(null),
      syncProducts
        ? productVariantSyncLogRepository.getProductVariantSyncLogByShop(
            session.shop,
          )
        : Promise.resolve(null),
    ]);

  if (
    (syncCustomers && customerSyncLog?.status === "IN_PROGRESS") ||
    (syncOrders && orderSyncLog?.status === "IN_PROGRESS") ||
    (syncProducts && productVariantSyncLog?.status === "IN_PROGRESS")
  ) {
    return;
  }

  const shopConnect = { connect: { id: shop.id } };
  const resetLog = {
    status: "IN_PROGRESS" as const,
    skippedCount: 0,
    syncedCount: 0,
    failedCount: 0,
    totalCount: 0,
    shop: shopConnect,
  };

  if (syncCustomers) {
    await customerSyncLogRepository.createOrUpdateCustomerSyncLog(resetLog);
  }
  if (syncOrders) {
    await orderSyncLogRepository.createOrUpdateOrderSyncLog(resetLog);
  }
  if (syncProducts) {
    await productVariantSyncLogRepository.createOrUpdateProductVariantSyncLog(
      resetLog,
    );
  }

  await DataSyncQueue.add(
    "data-sync",
    { shop: session.shop, kinds },
    {
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  );
}

async function enqueueMarketSyncJobIfEligible(shop: Shop): Promise<boolean> {
  if (!shop.isMarketSyncEnabled) {
    return false;
  }

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

  // The access token is fetched fresh inside the worker right before the job
  // runs (see worker.ts), so a token captured here can't go stale while the
  // job waits in the queue.
  await DataSyncMarketQueue.add(
    "data-sync-market",
    { shop: shop.shopUrl },
    {
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  );

  return true;
}

/**
 * Enqueues a market sync job after a shop's data-sync (products) finishes.
 * No-ops when the shop is missing, market sync is disabled, or a fresh
 * IN_PROGRESS run already exists. Unlike the daily cron, this path does not
 * apply MARKET_SYNC_MIN_INTERVAL_MS.
 */
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
 * Daily cron entrypoint: enqueues market sync jobs while keeping at most
 * MARKET_SYNC_MAX_CONCURRENT_SHOPS shops in progress at once.
 *
 * Counts shops already syncing (fresh IN_PROGRESS), then enqueues up to the
 * remaining budget, preferring shops that synced longest ago (never-synced
 * shops first, then oldest updatedAt).
 *
 * Shops whose last successful (COMPLETE) sync finished less than
 * MARKET_SYNC_MIN_INTERVAL_MS ago are skipped so a shop is not re-synced every
 * hour. Never-synced shops and shops whose last sync ended in ERROR are not
 * throttled. This interval applies only to the daily cron path; post data-sync
 * triggers (enqueueMarketSyncTaskForShopUrl) bypass it, but still require
 * isMarketSyncEnabled.
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

const PRODUCT_WEBHOOK_JOB_OPTS = {
  delay: PRODUCT_WEBHOOK_DEBOUNCE_MS,
  attempts: PRODUCT_WEBHOOK_JOB_ATTEMPTS,
  backoff: { type: "exponential" as const, delay: 5000 },
  removeOnComplete: true,
  removeOnFail: 1000,
};

/** BullMQ job ids cannot contain ":". GIDs do, so the id uses the numeric product id. */
export function productWebhookJobId(
  shopId: number,
  productGid: string,
): string {
  const numericId = productGid.split("/").pop() ?? "";
  return `product-webhook-${shopId}-${numericId}`;
}

function followUpJobId(jobId: string): string {
  return jobId.endsWith("-next")
    ? jobId.slice(0, -"-next".length)
    : `${jobId}-next`;
}

async function resetProductWebhookDelay(job: {
  changeDelay: (delay: number) => Promise<void>;
}): Promise<void> {
  try {
    await job.changeDelay(PRODUCT_WEBHOOK_DEBOUNCE_MS);
  } catch (error) {
    console.warn("[product-webhook] could not reset job delay", error);
  }
}

/**
 * Enqueues one debounced product webhook job.
 *
 * A later create/update/delete for the same product replaces the waiting job
 * and restarts the delay, so a CSV import's create-then-update pair becomes
 * a single run. If that job is already active, the new event is parked on a
 * sibling id and runs after.
 */
export async function enqueueProductWebhookJob(
  data: ProductWebhookJobData,
): Promise<void> {
  await placeProductWebhookJob(
    productWebhookJobId(data.shopId, data.productGid),
    data,
    true,
  );
}

async function placeProductWebhookJob(
  jobId: string,
  data: ProductWebhookJobData,
  canRedirect: boolean,
): Promise<void> {
  const existing = await ProductWebhookQueue.getJob(jobId);

  if (!existing) {
    const job = await ProductWebhookQueue.add(PRODUCT_WEBHOOK_JOB_NAME, data, {
      ...PRODUCT_WEBHOOK_JOB_OPTS,
      jobId,
    });
    const state = await job.getState();
    if (state === "delayed") {
      await job.updateData(data);
      await resetProductWebhookDelay(job);
      return;
    }
    if (
      canRedirect &&
      (state === "active" ||
        state === "waiting" ||
        state === "waiting-children")
    ) {
      await placeProductWebhookJob(followUpJobId(jobId), data, false);
    }
    return;
  }

  const state = await existing.getState();

  if (state === "delayed") {
    await existing.updateData(data);
    await resetProductWebhookDelay(existing);
    return;
  }

  if (state === "active" && canRedirect) {
    await placeProductWebhookJob(followUpJobId(jobId), data, false);
    return;
  }

  if (
    state === "waiting" ||
    state === "waiting-children" ||
    state === "completed" ||
    state === "failed" ||
    state === "unknown"
  ) {
    await existing.remove().catch(() => undefined);
    await ProductWebhookQueue.add(PRODUCT_WEBHOOK_JOB_NAME, data, {
      ...PRODUCT_WEBHOOK_JOB_OPTS,
      jobId,
    });
  }
}
