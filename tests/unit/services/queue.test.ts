import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const HOUR = 60 * 60 * 1000;
const added: {
  queue: string;
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
      constructor(readonly name: string) {}
      on() {}
      async add(
        name: string,
        data: { shop: string },
        opts?: Record<string, unknown>,
      ) {
        added.push({ queue: this.name, name, data, opts });
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
      getShopUrlsWithoutPublicApiKey: async () => shops,
    },
    customerSyncLogRepository: {},
    orderSyncLogRepository: {},
    productVariantSyncLogRepository: {},
  },
});

const {
  enqueueMarketSyncTaskForShopUrl,
  enqueueMarketSyncTasks,
  enqueueShopPublicKeys,
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

const shopWithLogs = (shopUrl: string, logs: [status: string, agoMs: number | null][]) => ({
  shopUrl,
  isMarketSyncEnabled: true,
  apiKey: "key",
  marketSyncLogs: logs.map(([status, agoMs]) => ({
    status,
    updatedAt: agoMs === null ? null : new Date(Date.now() - agoMs),
  })),
});
const shopCompletedAgo = (shopUrl: string, ms: number) =>
  shopWithLogs(shopUrl, [["COMPLETE", ms]]);

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

test("cron enqueues all 50 shops that are due", async () => {
  shops = Array.from({ length: 50 }, (_, i) =>
    shopCompletedAgo(`shop-${i}.myshopify.com`, 24 * HOUR),
  );

  assert.equal(await enqueueMarketSyncTasks(), 50);
  assert.equal(new Set(added.map((job) => job.data.shop)).size, 50);
});

test("cron: shops without logs go first and do not push out the rest, oldest sync next", async () => {
  // The due shops are listed from the newest sync to the oldest one.
  const due = Array.from({ length: 20 }, (_, i) =>
    shopCompletedAgo(`due-${i}.myshopify.com`, (24 + i) * HOUR),
  );
  const withoutLogs = Array.from({ length: 10 }, (_, i) =>
    shopWithLogs(`no-logs-${i}.myshopify.com`, []),
  );
  shops = [...due, ...withoutLogs];

  assert.equal(await enqueueMarketSyncTasks(), 30);
  assert.deepEqual(
    added.map((job) => job.data.shop),
    [...withoutLogs, ...[...due].reverse()].map((s) => s.shopUrl),
  );
});

test("cron: shops in progress are skipped and do not limit the others", async () => {
  const busy = Array.from({ length: 10 }, (_, i) =>
    shopWithLogs(`busy-${i}.myshopify.com`, [["IN_PROGRESS", HOUR]]),
  );
  shops = [...busy, shopCompletedAgo("due.myshopify.com", 24 * HOUR)];

  assert.equal(await enqueueMarketSyncTasks(), 1);
  assert.deepEqual(
    added.map((job) => job.data.shop),
    ["due.myshopify.com"],
  );
});

// Each case is one shop; a log is one country.
for (const [label, logs, expected] of [
  ["no logs", [], 1],
  ["every country COMPLETE 1h ago", [["COMPLETE", HOUR], ["COMPLETE", HOUR]], 0],
  ["COMPLETE exactly 20h ago", [["COMPLETE", 20 * HOUR]], 0],
  ["COMPLETE 20h and 1ms ago", [["COMPLETE", 20 * HOUR + 1]], 1],
  ["one country COMPLETE 9h ago, the other COMPLETE 33h ago", [["COMPLETE", 9 * HOUR], ["COMPLETE", 33 * HOUR]], 1],
  ["one country COMPLETE 9h ago, the other ERROR 33h ago", [["COMPLETE", 9 * HOUR], ["ERROR", 33 * HOUR]], 1],
  ["one country COMPLETE 1h ago, the other ERROR 1h ago", [["COMPLETE", HOUR], ["ERROR", HOUR]], 1],
  ["COMPLETE without updatedAt", [["COMPLETE", null]], 1],
  ["IN_PROGRESS exactly 5h ago", [["COMPLETE", 33 * HOUR], ["IN_PROGRESS", 5 * HOUR]], 0],
  ["IN_PROGRESS 5h and 1ms ago, the other country COMPLETE 6h ago", [["COMPLETE", 6 * HOUR], ["IN_PROGRESS", 5 * HOUR + 1]], 1],
] as [string, [string, number | null][], number][]) {
  test(`cron: ${label} -> ${expected ? "enqueued" : "skipped"}`, async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
    shops = [shopWithLogs(SHOP, logs)];

    assert.equal(await enqueueMarketSyncTasks(), expected);
    assert.equal(added.length, expected);
  });
}

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
        queue: "data-sync-market",
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
        queue: "webhook-events",
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

test("event key jobs: own queue, only the shop in the data, nothing kept after the run", async () => {
  shops = [{ shopUrl: "a.myshopify.com" }, { shopUrl: "b.myshopify.com" }];

  assert.equal(await enqueueShopPublicKeys(), 2);
  assert.deepEqual(
    added,
    ["a.myshopify.com", "b.myshopify.com"].map((shopUrl) => ({
      queue: "shop-public-key",
      name: "create-public-key",
      data: { shop: shopUrl },
      opts: {
        jobId: `public-key-${shopUrl}`,
        attempts: 5,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    })),
  );
  assert.ok(added.every((job) => !String(job.opts?.jobId).includes(":")));
});

test("event key jobs: nothing is added when every shop has a key", async () => {
  shops = [];

  assert.equal(await enqueueShopPublicKeys(), 0);
  assert.deepEqual(added, []);
});
