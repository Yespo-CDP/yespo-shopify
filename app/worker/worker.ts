import { Worker } from "bullmq";

import { redisConfig } from "~/config/redis";
import { shopRepository } from "~/repositories/repositories.server";
import { customerSyncHandler } from "./handlers/customer-sync-handler";
import { orderSyncHandler } from "./handlers/order-sync-handler";
import { productSyncHandler } from "./handlers/product-sync-handler";
import { marketSyncHandler } from "./handlers/market-sync-handler";

interface JobData {
  shop?: string;
  accessToken?: string;
  type: "order" | "customer" | "product";
}

interface MarketSyncJobData {
  shop?: string;
  accessToken?: string;
}

console.log("===RUN WORKER===");

new Worker<JobData>(
  "data-sync",
  async (job) => {
    try {
      const { shop, accessToken } = job?.data;

      if (!shop || !accessToken) return;

      const shopData = await shopRepository.getShop(shop);
      const apiKey = shopData?.apiKey;

      if (!apiKey) {
        console.error(
          `Error data synchronization: Api key not found for ${shop}`,
        );
        return;
      }
      await customerSyncHandler(
        shop,
        accessToken,
        apiKey,
        shopData.id,
        shopData.orgId,
      );
      await orderSyncHandler(
        shop,
        accessToken,
        apiKey,
        shopData.id,
        shopData.orgId,
      );
      await productSyncHandler(
        shop,
        accessToken,
        apiKey,
        shopData.id,
        shopData.orgId,
        shopData.siteId,
      );
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
      const { shop, accessToken } = job?.data;

      if (!shop || !accessToken) return;

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
    concurrency: 3,
  },
);
