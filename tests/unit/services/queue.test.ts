import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const HOUR = 60 * 60 * 1000;
const added: {
  name: string;
  data: { shop: string };
  opts?: Record<string, unknown>;
}[] = [];
let shops: unknown[] = [];
let shop: unknown = null;
const redisCalls: unknown[][] = [];
let saddError: Error | null = null;
let execResult: () => Promise<[Error | null, unknown][] | null> = async () => [];

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
  namedExports: {
    bullmqConnection: {},
    redisConnection: {
      sadd: async (...args: unknown[]) => {
        redisCalls.push(["sadd", ...args]);
        if (saddError) throw saddError;
      },
      multi: () => {
        redisCalls.push(["multi"]);
        const chain = {
          smembers: (key: string) => {
            redisCalls.push(["smembers", key]);
            return chain;
          },
          del: (key: string) => {
            redisCalls.push(["del", key]);
            return chain;
          },
          exec: () => execResult(),
        };
        return chain;
      },
    },
  },
});
mock.module("../../../app/repositories/repositories.server", {
  namedExports: {
    shopRepository: {
      getShopsForMarketSync: async () => shops,
      getShop: async () => shop,
    },
    customerSyncLogRepository: {},
    orderSyncLogRepository: {},
    productVariantSyncLogRepository: {},
  },
});

const {
  enqueueMarketSyncTaskForShopUrl,
  enqueueMarketSyncTasks,
  enqueueWebhookEvent,
  takeMarketSyncScope,
} = await import("../../../app/services/queue");

const SHOP = "demo.myshopify.com";
const SCOPE_KEY = `market-sync:scope:${SHOP}`;
const EUROPE = "gid://shopify/Market/1";
const USA = "gid://shopify/Market/2";

beforeEach(() => {
  added.length = 0;
  redisCalls.length = 0;
  saddError = null;
  shop = { shopUrl: SHOP, isMarketSyncEnabled: true, apiKey: "key" };
});

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
  assert.deepEqual(redisCalls, [
    ["sadd", "market-sync:scope:yesterday.myshopify.com", "all"],
  ]);
});

for (const [label, options, member] of [
  ["one market", { marketId: EUROPE }, EUROPE],
  ["a full shop run", undefined, "all"],
] as const) {
  test(`market sync of ${label}: the scope is saved and one deduplicated job is added`, async () => {
    const enqueued = await enqueueMarketSyncTaskForShopUrl(SHOP, options);

    assert.equal(enqueued, 1);
    assert.deepEqual(redisCalls, [["sadd", SCOPE_KEY, member]]);
    assert.deepEqual(added, [
      {
        name: "data-sync-market",
        data: { shop: SHOP },
        opts: {
          deduplication: { id: SHOP, keepLastIfActive: true },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      },
    ]);
  });
}

test("market sync: no job is added when the scope cannot be saved", async () => {
  saddError = new Error("redis down");

  await assert.rejects(enqueueMarketSyncTaskForShopUrl(SHOP), /redis down/);
  assert.deepEqual(added, []);
});

test("market sync: nothing is saved or added when sync is off or there is no API key", async () => {
  shop = { shopUrl: SHOP, isMarketSyncEnabled: false, apiKey: "key" };
  assert.equal(await enqueueMarketSyncTaskForShopUrl(SHOP), 0);
  shop = { shopUrl: SHOP, isMarketSyncEnabled: true, apiKey: null };
  const consoleError = mock.method(console, "error", () => {});
  assert.equal(await enqueueMarketSyncTaskForShopUrl(SHOP), 0);
  consoleError.mock.restore();

  assert.deepEqual(redisCalls, []);
  assert.deepEqual(added, []);
});

for (const [label, members, expected] of [
  ["one market", [EUROPE], EUROPE],
  ["two markets", [EUROPE, USA], null],
  ["a full run", ["all"], null],
  ["one market and a full run", [EUROPE, "all"], null],
  ["an empty scope", [], null],
] as const) {
  test(`takeMarketSyncScope: ${label}, the key is read and deleted together`, async () => {
    execResult = async () => [
      [null, [...members]],
      [null, members.length ? 1 : 0],
    ];

    assert.equal(await takeMarketSyncScope(SHOP), expected);
    assert.deepEqual(redisCalls, [["multi"], ["smembers", SCOPE_KEY], ["del", SCOPE_KEY]]);
  });
}

for (const [label, result] of [
  ["the transaction fails", async () => Promise.reject(new Error("redis down"))],
  ["the read command fails", async () => [[new Error("WRONGTYPE"), undefined], [null, 1]]],
  ["the transaction returns nothing", async () => null],
] as [string, typeof execResult][]) {
  test(`takeMarketSyncScope: ${label}, the run is full and the error is logged`, async () => {
    execResult = result;
    const consoleError = mock.method(console, "error", () => {});

    const scope = await takeMarketSyncScope(SHOP);
    const logged = consoleError.mock.callCount();
    consoleError.mock.restore();

    assert.equal(scope, null);
    assert.equal(logged, 1);
  });
}

for (const [topic, backoff] of [
  ["CUSTOMERS_CREATE", { type: "fixed", delay: 65_000 }],
  ["CUSTOMERS_UPDATE", { type: "fixed", delay: 65_000 }],
  ["ORDERS_CREATE", { type: "exponential", delay: 5000 }],
  ["ORDERS_UPDATED", { type: "exponential", delay: 5000 }],
  ["ORDERS_DELETE", { type: "exponential", delay: 5000 }],
  ["CARTS_UPDATE", { type: "exponential", delay: 5000 }],
] as const) {
  test(`${topic} job is retried with ${backoff.type} backoff of ${backoff.delay} ms`, async () => {
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
