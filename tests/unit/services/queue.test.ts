import assert from "node:assert/strict";
import { mock, test } from "node:test";

const HOUR = 60 * 60 * 1000;
const added: {
  name: string;
  data: { shop: string };
  opts?: Record<string, unknown>;
}[] = [];
let shops: unknown[] = [];

mock.module("bullmq", {
  namedExports: {
    Queue: class {
      on() {}
      async add(
        name: string,
        data: { shop: string },
        opts?: Record<string, unknown>,
      ) {
        added.push({ name, data, opts });
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

const { enqueueMarketSyncTasks, enqueueWebhookEvent } = await import(
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

for (const [topic, backoff] of [
  ["CUSTOMERS_CREATE", { type: "fixed", delay: 65_000 }],
  ["CUSTOMERS_UPDATE", { type: "fixed", delay: 65_000 }],
  ["ORDERS_CREATE", { type: "exponential", delay: 5000 }],
  ["ORDERS_UPDATED", { type: "exponential", delay: 5000 }],
  ["ORDERS_DELETE", { type: "exponential", delay: 5000 }],
  ["CARTS_UPDATE", { type: "exponential", delay: 5000 }],
] as const) {
  test(`${topic} job is retried with ${backoff.type} backoff of ${backoff.delay} ms`, async () => {
    added.length = 0;
    const data = { shop: "demo.myshopify.com", topic, payload: {} };

    await enqueueWebhookEvent(data, "wh-1");

    assert.deepEqual(added, [
      {
        name: topic,
        data,
        opts: {
          jobId: "webhook-wh-1",
          attempts: 5,
          backoff,
          removeOnComplete: true,
          removeOnFail: true,
        },
      },
    ]);
  });
}
