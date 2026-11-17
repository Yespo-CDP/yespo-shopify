import { Worker } from "bullmq";

import { bullmqConnection } from "~/config/redis";
import {
  customerSyncLogRepository,
  eventDataRepository,
  orderSyncLogRepository,
  productVariantSyncLogRepository,
  shopRepository,
} from "~/repositories/repositories.server";
import { migrateOfflineTokenToExpiring } from "~/services/migrate-offline-token.server";
import { customerSyncHandler } from "./handlers/customer-sync-handler";
import { orderSyncHandler } from "./handlers/order-sync-handler";
import { productSyncHandler } from "./handlers/product-sync-handler";
import { marketSyncHandler } from "./handlers/market-sync-handler";
import { productWebhookHandler } from "./handlers/product-webhook-handler";
import { createOfflineTokenManager } from "./services/offline-token-manager";
import {
  DB_CLEANER_CRON_JOB_NAME,
  enqueueMarketSyncTaskForShopUrl,
  enqueueMarketSyncTasks,
  MARKET_SYNC_CRON_JOB_NAME,
  PRODUCT_WEBHOOK_QUEUE_NAME,
  type ProductWebhookJobData,
  registerDbCleanerCron,
  registerMarketSyncCron,
} from "~/services/queue";

interface JobData {
  shop?: string;
  kinds?: Array<"customer" | "order" | "product">;
}

interface MarketSyncJobData {
  shop?: string;
  /** When set, the run syncs only this market. Omit for a full shop sync. */
  marketId?: string;
}

interface TokenMigrationJobData {
  shop?: string;
}

console.log("===RUN WORKER===");

await registerMarketSyncCron();
await registerDbCleanerCron();

const cronWorker = new Worker(
  "cron-jobs",
  async (job) => {
    if (job.name === MARKET_SYNC_CRON_JOB_NAME) {
      console.log(`Market sync started`);

      const enqueued = await enqueueMarketSyncTasks();
      console.log(`Market sync cron tick: enqueued ${enqueued} shop(s)`);
    }

    if (job.name === DB_CLEANER_CRON_JOB_NAME) {
      await eventDataRepository.bulkDeleteEventsData();
      console.log("Expired EventData cleaned");
    }
  },
  {
    connection: bullmqConnection,
    concurrency: 1,
  },
);

/**
 * Sets ERROR on the job's sync logs that are still IN_PROGRESS, so the admin
 * doesn't show an import that will never finish. Logs a handler already
 * finished (COMPLETE/ERROR) are left as they are. Never throws.
 */
async function markUnfinishedSyncLogsAsError(
  shop: string,
  shopId: number,
  kinds: NonNullable<JobData["kinds"]>,
) {
  const errorLog = {
    status: "ERROR" as const,
    shop: { connect: { id: shopId } },
  };

  try {
    if (kinds.includes("customer")) {
      const log =
        await customerSyncLogRepository.getCustomerSyncLogByShop(shop);
      if (log?.status === "IN_PROGRESS") {
        await customerSyncLogRepository.createOrUpdateCustomerSyncLog(errorLog);
      }
    }
    if (kinds.includes("order")) {
      const log = await orderSyncLogRepository.getOrderSyncLogByShop(shop);
      if (log?.status === "IN_PROGRESS") {
        await orderSyncLogRepository.createOrUpdateOrderSyncLog(errorLog);
      }
    }
    if (kinds.includes("product")) {
      const log =
        await productVariantSyncLogRepository.getProductVariantSyncLogByShop(
          shop,
        );
      if (log?.status === "IN_PROGRESS") {
        await productVariantSyncLogRepository.createOrUpdateProductVariantSyncLog(
          errorLog,
        );
      }
    }
  } catch (error: unknown) {
    console.error(
      `Data sync: failed to mark sync logs as ERROR for ${shop}:`,
      error,
    );
  }
}

const dataSyncWorker = new Worker<JobData>(
  "data-sync",
  async (job) => {
    const { shop } = job?.data ?? {};

    if (!shop) return;

    const kinds = job.data.kinds ?? ["customer", "order"];
    let shopId: number | undefined;

    try {
      const shopData = await shopRepository.getShop(shop);
      shopId = shopData?.id;

      const tokenManager = createOfflineTokenManager(shop);
      const accessToken = await tokenManager.getAccessToken();
      if (!accessToken) {
        console.error(`Data sync: no valid offline session for ${shop}`);
        if (shopId) await markUnfinishedSyncLogsAsError(shop, shopId, kinds);
        return;
      }

      const apiKey = shopData?.apiKey;

      if (!apiKey) {
        console.error(
          `Error data synchronization: Api key not found for ${shop}`,
        );
        if (shopId) await markUnfinishedSyncLogsAsError(shop, shopId, kinds);
        return;
      }

      if (kinds.includes("customer")) {
        await customerSyncHandler(
          shop,
          accessToken,
          apiKey,
          shopData.id,
          shopData.orgId,
          tokenManager,
        );
      }
      if (kinds.includes("order")) {
        await orderSyncHandler(
          shop,
          accessToken,
          apiKey,
          shopData.id,
          shopData.orgId,
          tokenManager,
        );
      }
      if (kinds.includes("product")) {
        await productSyncHandler(
          shop,
          accessToken,
          apiKey,
          shopData.id,
          shopData.orgId,
          shopData.siteId,
          tokenManager,
        );
        await enqueueMarketSyncTaskForShopUrl(shop);
      }
    } catch (error: any) {
      console.error(`Worker error:`, error);
      if (shopId) await markUnfinishedSyncLogsAsError(shop, shopId, kinds);
    }
  },
  {
    connection: bullmqConnection,
    concurrency: 10,
  },
);

const marketSyncWorker = new Worker<MarketSyncJobData>(
  "data-sync-market",
  async (job) => {
    try {
      const { shop, marketId } = job?.data ?? {};

      if (!shop) return;

      const tokenManager = createOfflineTokenManager(shop);
      const accessToken = await tokenManager.getAccessToken();
      if (!accessToken) {
        console.error(`Market sync: no valid offline session for ${shop}`);
        return;
      }

      const shopData = await shopRepository.getShop(shop);
      const apiKey = shopData?.apiKey;

      if (!apiKey) {
        console.error(`Error market sync: Api key not found for ${shop}`);
        return;
      }

      await marketSyncHandler(
        shop,
        accessToken,
        apiKey,
        shopData.id,
        shopData.orgId,
        shopData.siteId,
        marketId,
        tokenManager,
      );
    } catch (error: unknown) {
      console.error(`Market sync worker error:`, error);
    }
  },
  {
    connection: bullmqConnection,
    concurrency: 10,
  },
);

// One job at a time: each run rewrites the shop's sync counters from a full
// recount, so overlapping product jobs would overwrite each other.
const productWebhookWorker = new Worker<ProductWebhookJobData>(
  PRODUCT_WEBHOOK_QUEUE_NAME,
  async (job) => {
    await productWebhookHandler(job.data);
  },
  {
    connection: bullmqConnection,
    concurrency: 1,
  },
);

const tokenMigrationWorker = new Worker<TokenMigrationJobData>(
  "token-migration",
  async (job) => {
    const { shop } = job?.data ?? {};
    if (!shop) return;

    const result = await migrateOfflineTokenToExpiring(shop);
    console.log(`Token migration ${shop}: ${result}`);
  },
  {
    connection: bullmqConnection,
    concurrency: 5,
  },
);

const workers = [
  cronWorker,
  dataSyncWorker,
  marketSyncWorker,
  productWebhookWorker,
  tokenMigrationWorker,
];

for (const worker of workers) {
  worker.on("error", (error) => {
    console.error(`[worker:${worker.name}] Redis error:`, error?.message);
  });
}

// close() stops taking new jobs and waits for active ones. It leaves the shared
// Redis client open, so the process has to exit explicitly.
let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return; // Heroku may send SIGTERM more than once
  shuttingDown = true;
  console.log(`[worker] ${signal}: closing workers`);
  await Promise.allSettled(workers.map((w) => w.close()));
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
