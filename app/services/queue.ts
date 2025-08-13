import { Queue } from "bullmq";

import { redisConfig } from "~/config/redis";
import type { Session } from "@shopify/shopify-app-remix/server";

export const DataSyncQueue = new Queue("data-sync", {
  connection: redisConfig,
});

export async function enqueueDataSyncTasks({ session }: { session: Session }) {
  console.log("Enqueueing data sync tasks...", session);
  await DataSyncQueue.add(
    "data-sync",
    { ...session, type: "customer" },
    {
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  );

  await DataSyncQueue.add(
    "data-sync",
    { ...session, type: "order" },
    {
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  );
}
