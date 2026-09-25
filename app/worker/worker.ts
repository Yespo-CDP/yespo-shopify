import { Worker } from "bullmq";

import { redisConfig } from "~/config/redis";
import {
  eventDataRepository,
  shopRepository,
} from "~/repositories/repositories.server";
import { getOfflineAccessToken } from "~/services/get-offline-session.server";
import { migrateOfflineTokenToExpiring } from "~/services/migrate-offline-token.server";
import { customerSyncHandler } from "./handlers/customer-sync-handler";
import { orderSyncHandler } from "./handlers/order-sync-handler";
import { productSyncHandler } from "./handlers/product-sync-handler";
import { marketSyncHandler } from "./handlers/market-sync-handler";
import { productWebhookHandler } from "./handlers/product-webhook-handler";
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
}

interface TokenMigrationJobData {
  shop?: string;
}

console.log("===RUN WORKER===");

await registerMarketSyncCron();
await registerDbCleanerCron();

new Worker(
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
    connection: redisConfig,
    concurrency: 1,
  },
);

new Worker<JobData>(
  "data-sync",
  async (job) => {
    try {
      const { shop } = job?.data;

      if (!shop) return;

      const accessToken = await getOfflineAccessToken(shop);
      if (!accessToken) {
        console.error(`Data sync: no valid offline session for ${shop}`);
        return;
      }

      const shopData = await shopRepository.getShop(shop);
      const apiKey = shopData?.apiKey;

      if (!apiKey) {
        console.error(
          `Error data synchronization: Api key not found for ${shop}`,
        );
        return;
      }
      const kinds = job.data.kinds ?? ["customer", "order"];

      if (kinds.includes("customer")) {
        await customerSyncHandler(
          shop,
          accessToken,
          apiKey,
          shopData.id,
          shopData.orgId,
        );
      }
      if (kinds.includes("order")) {
        await orderSyncHandler(
          shop,
          accessToken,
          apiKey,
          shopData.id,
          shopData.orgId,
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
        );
        await enqueueMarketSyncTaskForShopUrl(shop);
      }
    } catch (error: any) {
      console.error(`Worker error:`, error);
    }
  },
  {
    connection: redisConfig,
    concurrency: 10,
  },
);

new Worker<MarketSyncJobData>(
  "data-sync-market",
  async (job) => {
    try {
      const { shop } = job?.data;

      if (!shop) return;

      const accessToken = await getOfflineAccessToken(shop);
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
      );
    } catch (error: unknown) {
      console.error(`Market sync worker error:`, error);
    }
  },
  {
    connection: redisConfig,
    concurrency: 10,
  },
);

// One job at a time: each run rewrites the shop's sync counters from a full
// recount, so overlapping product jobs would overwrite each other.
new Worker<ProductWebhookJobData>(
  PRODUCT_WEBHOOK_QUEUE_NAME,
  async (job) => {
    await productWebhookHandler(job.data);
  },
  {
    connection: redisConfig,
    concurrency: 1,
  },
);

new Worker<TokenMigrationJobData>(
  "token-migration",
  async (job) => {
    const { shop } = job?.data ?? {};
    if (!shop) return;

    const result = await migrateOfflineTokenToExpiring(shop);
    console.log(`Token migration ${shop}: ${result}`);
  },
  {
    connection: redisConfig,
    concurrency: 5,
  },
);
