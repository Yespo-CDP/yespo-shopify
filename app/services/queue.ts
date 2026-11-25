import { Queue } from "bullmq";

import { bullmqConnection, redisConnection } from "~/config/redis";
import {
  DB_CLEANER_CRON_PATTERN,
  MARKET_SYNC_CRON_PATTERN,
  MARKET_SYNC_MIN_INTERVAL_MS,
  MARKET_SYNC_STALE_AFTER_MS,
  PRODUCT_WEBHOOK_DEBOUNCE_MS,
  PRODUCT_WEBHOOK_JOB_ATTEMPTS,
} from "~/config/constants";
import {
  customerSyncLogRepository,
  orderSyncLogRepository,
  productVariantSyncLogRepository,
  shopRepository,
} from "~/repositories/repositories.server";
import type { Shop, ShopWithMarketSyncLogs } from "~/@types/shop";
import type { Session } from "@shopify/shopify-app-react-router/server";

function createQueue(name: string): Queue {
  const queue = new Queue(name, { connection: bullmqConnection });
  queue.on("error", (error) => {
    console.error(`[queue:${name}] Redis error:`, error?.message);
  });
  return queue;
}

export const DataSyncQueue = createQueue("data-sync");

export const DataSyncMarketQueue = createQueue("data-sync-market");

export const CronQueue = createQueue("cron-jobs");

export const TokenMigrationQueue = createQueue("token-migration");

export const PRODUCT_WEBHOOK_QUEUE_NAME = "product-webhooks";
export const PRODUCT_WEBHOOK_JOB_NAME = "product-webhook";

export const ProductWebhookQueue = createQueue(PRODUCT_WEBHOOK_QUEUE_NAME);

export type ProductWebhookTopic =
  "PRODUCTS_CREATE" | "PRODUCTS_UPDATE" | "PRODUCTS_DELETE";

export interface ProductWebhookJobData {
  shop: string;
  shopId: number;
  topic: ProductWebhookTopic;
  productGid: string;
}

export const WEBHOOK_EVENT_QUEUE_NAME = "webhook-events";

export const WebhookEventQueue = createQueue(WEBHOOK_EVENT_QUEUE_NAME);

/** A customers, orders or carts webhook, processed by the worker. */
export interface WebhookEventJobData {
  shop: string;
  topic: string;
  payload: unknown;
}

/**
 * Enqueues a customers/orders/carts webhook so the route can answer Shopify
 * right away. The job id comes from X-Shopify-Webhook-Id, so a repeated
 * delivery is skipped while the first job is still in the queue. Failed jobs
 * are removed because the payload holds customer data; the worker logs them.
 * The worker also queues the order of an orders/create job this way, with
 * `order-create-<order id>` instead of the webhook id.
 *
 * Yespo answers a repeated `POST /contact` within 1 minute with 409, so
 * customers/* jobs wait 65 s before every retry. Other jobs wait 5, 10, 20 and 40 s.
 */
export async function enqueueWebhookEvent(
  data: WebhookEventJobData,
  webhookId: string,
): Promise<void> {
  await WebhookEventQueue.add(data.topic, data, {
    jobId: `webhook-${webhookId}`,
    attempts: 5,
    backoff: data.topic.startsWith("CUSTOMERS_")
      ? { type: "fixed", delay: 65_000 }
      : { type: "exponential", delay: 5000 },
    removeOnComplete: true,
    removeOnFail: true,
  });
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
 * Registers the daily (03:00 UTC) market-sync scheduler in Redis. Safe to call
 * on every worker startup — BullMQ upserts the scheduler by id, replacing the
 * pending run of the previous pattern.
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
 * Registers the daily EventData TTL cleanup scheduler in Redis. The same job
 * also deletes TmpMarketSync rows older than TMP_MARKET_SYNC_TTL_MS (24 h).
 * Safe to call on every worker startup — BullMQ upserts the scheduler by id.
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

/** Scope member of a full shop sync; the other members are market GIDs. */
const MARKET_SYNC_SCOPE_ALL = "all";

/** Redis set of what the shop's next market sync has to cover. */
function marketSyncScopeKey(shopUrl: string): string {
  return `market-sync:scope:${shopUrl}`;
}

/**
 * Reads and clears the scope of the shop's market sync. Returns the market GID
 * when that one market is all that was asked for. Returns null for a full
 * sync: several markets, a full request, no scope, or Redis failed to read it.
 */
export async function takeMarketSyncScope(
  shopUrl: string,
): Promise<string | null> {
  const key = marketSyncScopeKey(shopUrl);

  try {
    const results = await redisConnection.multi().smembers(key).del(key).exec();
    const [error, members] = results?.[0] ?? [new Error("no reply"), null];
    if (error) {
      throw error;
    }

    const scope = members as string[];
    return scope.length === 1 && scope[0] !== MARKET_SYNC_SCOPE_ALL
      ? scope[0]
      : null;
  } catch (error: unknown) {
    console.error(
      `Market sync: failed to read the scope for ${shopUrl}, running a full sync:`,
      (error as Error)?.message,
    );
    return null;
  }
}

async function enqueueMarketSyncJobIfEligible(
  shop: Shop,
  options?: { marketId?: string },
): Promise<boolean> {
  if (!shop.isMarketSyncEnabled) {
    return false;
  }

  if (!shop.apiKey) {
    console.error(`Market sync: Api key not found for ${shop.shopUrl}`);
    return false;
  }

  // Saved before the job is added: a run that starts after this reads it, and a
  // run without a scope is a full one. It is not in the job data because BullMQ
  // drops the data of a duplicate job.
  await redisConnection.sadd(
    marketSyncScopeKey(shop.shopUrl),
    options?.marketId ?? MARKET_SYNC_SCOPE_ALL,
  );

  // The access token is fetched fresh inside the worker right before the job
  // runs (see worker.ts), so a token captured here can't go stale while the
  // job waits in the queue.
  await DataSyncMarketQueue.add(
    "data-sync-market",
    { shop: shop.shopUrl },
    {
      // At most one active and one waiting job per shop. A job added during a
      // run starts after it.
      deduplication: { id: shop.shopUrl, keepLastIfActive: true },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  );

  return true;
}

/**
 * Enqueues a market sync job after a shop's data-sync (products) finishes,
 * and after a markets webhook when a market is added, enabled, or removed.
 *
 * `marketId` limits the run to that market. Omit it for a full shop sync
 * (first enable, removal cleanup, post-product sync, daily cron).
 *
 * Requests that reach Redis before the job starts are merged into one run: the
 * same market stays a single-market run, anything else becomes a full one. A
 * request made during a run starts another run after it.
 *
 * No-ops when the shop is missing, has no API key, or market sync is disabled.
 * Unlike the daily cron, this path does not apply MARKET_SYNC_MIN_INTERVAL_MS.
 */
export async function enqueueMarketSyncTaskForShopUrl(
  shopUrl: string,
  options?: { marketId?: string },
): Promise<number> {
  const shop = await shopRepository.getShop(shopUrl);
  if (!shop) {
    return 0;
  }

  return (await enqueueMarketSyncJobIfEligible(shop, options)) ? 1 : 0;
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
 * Whether the cron can skip the shop: it has MarketSyncLog rows and every one
 * is COMPLETE and fresh (updatedAt >= minIntervalBefore). A run of one market
 * refreshes only that market's countries, so one fresh row is not enough.
 */
function syncedRecently(
  shop: ShopWithMarketSyncLogs,
  minIntervalBefore: Date,
): boolean {
  return (
    shop.marketSyncLogs.length > 0 &&
    shop.marketSyncLogs.every(
      (log) =>
        log.status === "COMPLETE" &&
        log.updatedAt != null &&
        log.updatedAt >= minIntervalBefore,
    )
  );
}

/**
 * Daily cron entrypoint: enqueues a market sync job for every shop that is due,
 * shops that synced longest ago first (never-synced shops, then oldest
 * updatedAt). How many of them run at once is limited by the data-sync-market
 * worker (MARKET_SYNC_MAX_CONCURRENT_SHOPS), not here.
 *
 * Shops with a fresh IN_PROGRESS log are skipped. Shops where every country
 * finished (COMPLETE) less than MARKET_SYNC_MIN_INTERVAL_MS (20h) ago are
 * skipped too, so a shop synced off schedule later in the day waits for the
 * next day's tick, while a shop that finished shortly after the previous tick
 * is still picked up by this one. Never-synced shops and shops with a country
 * in ERROR are not throttled. This interval applies only to the daily cron
 * path; post data-sync triggers (enqueueMarketSyncTaskForShopUrl) bypass it,
 * but still require isMarketSyncEnabled.
 */
export async function enqueueMarketSyncTasks(): Promise<number> {
  const staleBefore = new Date(Date.now() - MARKET_SYNC_STALE_AFTER_MS);
  const minIntervalBefore = new Date(Date.now() - MARKET_SYNC_MIN_INTERVAL_MS);
  const shops = await shopRepository.getShopsForMarketSync();

  const candidates = shops
    .filter((shop) => !isFreshInProgress(shop, staleBefore))
    .filter((shop) => !syncedRecently(shop, minIntervalBefore))
    .map((shop) => ({ shop, lastSyncedAt: lastSyncedAt(shop) }))
    .sort((a, b) => {
      // Never-synced shops (null) come first, then oldest updatedAt first.
      if (a.lastSyncedAt === null && b.lastSyncedAt === null) return 0;
      if (a.lastSyncedAt === null) return -1;
      if (b.lastSyncedAt === null) return 1;
      return a.lastSyncedAt.getTime() - b.lastSyncedAt.getTime();
    });

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
