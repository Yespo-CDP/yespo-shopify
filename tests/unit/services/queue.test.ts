import assert from "node:assert/strict";
import { mock, test } from "node:test";

const HOUR = 60 * 60 * 1000;
const added: { name: string; data: { shop: string } }[] = [];
let shops: unknown[] = [];

mock.module("bullmq", {
  namedExports: {
    Queue: class {
      on() {}
      async add(name: string, data: { shop: string }) {
        added.push({ name, data });
      }
    },
  },
});
mock.module("../../../app/config/redis", {
  namedExports: { bullmqConnection: {} },
});
mock.module("../../../app/repositories/repositories.server", {
  namedExports: {
    shopRepository: { getShopsForMarketSync: async () => shops },
    marketSyncLogRepository: { hasFreshInProgressByShop: async () => false },
    customerSyncLogRepository: {},
    orderSyncLogRepository: {},
    productVariantSyncLogRepository: {},
  },
});

const { enqueueMarketSyncTasks } = await import(
  "../../../app/services/queue"
);

const shopCompletedAgo = (shopUrl: string, ms: number) => ({
  shopUrl,
  isMarketSyncEnabled: true,
  apiKey: "key",
  marketSyncLogs: [
    { status: "COMPLETE", updatedAt: new Date(Date.now() - ms) },
  ],
});

test("cron re-syncs a shop finished 23h40m ago and skips one finished 1h ago", async () => {
  shops = [
    shopCompletedAgo("yesterday.myshopify.com", 23 * HOUR + 40 * 60 * 1000),
    shopCompletedAgo("recent.myshopify.com", HOUR),
  ];

  const enqueued = await enqueueMarketSyncTasks();

  assert.equal(enqueued, 1);
  assert.deepEqual(
    added.map((job) => job.data.shop),
    ["yesterday.myshopify.com"],
  );
});
