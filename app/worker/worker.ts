import { Worker } from "bullmq";

import { redisConfig } from "~/config/redis";
import { customerSyncHandler } from "./handlers/customer-sync-handler";

interface JobData {
  shop?: string;
  accessToken?: string;
}

console.log("===RUN WORKER===");

new Worker<JobData>(
  "data-sync",
  async (job) => {
    const { shop, accessToken } = job?.data;

    if (!shop || !accessToken) return;

    await customerSyncHandler(shop, accessToken);
  },
  {
    connection: redisConfig,
    concurrency: 10,
  },
);
