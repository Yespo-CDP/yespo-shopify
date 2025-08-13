import { Worker } from "bullmq";

import { redisConfig } from "~/config/redis";
import { shopRepository } from "~/repositories/repositories.server";
import { customerSyncHandler } from "./handlers/customer-sync-handler";
import { orderSyncHandler } from "./handlers/order-sync-handler";

interface JobData {
  shop?: string;
  accessToken?: string;
  type: "order" | "customer";
}

console.log("===RUN WORKER===");

new Worker<JobData>(
  "data-sync",
  async (job) => {
    try {
      const { shop, accessToken, type } = job?.data;

      if (!shop || !accessToken) return;

      const shopData = await shopRepository.getShop(shop);
      const apiKey = shopData?.apiKey;

      if (!apiKey) {
        console.error(
          `Error data synchronization: Api key not found for ${shop}`,
        );
        return;
      }

      switch (type) {
        case "customer":
          await customerSyncHandler(shop, accessToken, apiKey, shopData.id);
          break;
        case "order":
          await orderSyncHandler(shop, accessToken, apiKey, shopData.id);
          break;
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
