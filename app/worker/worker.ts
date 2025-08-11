import { Worker } from "bullmq";

import { redisConfig } from "~/config/redis";
import { shopRepository } from "~/repositories/repositories.server";
import { customerSyncHandler } from "./handlers/customer-sync-handler";

interface JobData {
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

      await customerSyncHandler(shop, accessToken, apiKey, shopData.id);
    } catch (error: any) {
      console.error(`Worker error:`, error);
    }
  },
  {
    connection: redisConfig,
    concurrency: 10,
  },
);
