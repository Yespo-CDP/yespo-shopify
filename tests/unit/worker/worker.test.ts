import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import { SessionNotFoundError } from "@shopify/shopify-app-react-router/server";

type Kind = "customer" | "order" | "product";
type Processor = (job: { data: unknown; [key: string]: unknown }) => Promise<unknown>;

const processors = new Map<string, Processor>();
const concurrencies = new Map<string, number | undefined>();
const statuses: Partial<Record<Kind, string>> = {};
const errorWrites: Kind[] = [];
let shopData: { id: number; apiKey: string; shopId?: string } | null = null;
let accessToken: string | null = null;
let customerSyncHandler = async () => {};
const closedQueues: string[] = [];
let finishClose = () => {};
const closeDone = new Promise<void>((resolve) => {
  finishClose = resolve;
});

const syncLog = (kind: Kind) => ({
  get: async () => (statuses[kind] ? { status: statuses[kind] } : null),
  set: async (data: { status: string }) => {
    statuses[kind] = data.status;
    if (data.status === "ERROR") errorWrites.push(kind);
    return {};
  },
});
const customerLog = syncLog("customer");
const orderLog = syncLog("order");
const productLog = syncLog("product");

mock.module("bullmq", {
  namedExports: {
    Worker: class {
      constructor(
        readonly name: string,
        processor: Processor,
        opts: { concurrency?: number },
      ) {
        processors.set(name, processor);
        concurrencies.set(name, opts.concurrency);
      }
      on() {}
      close() {
        closedQueues.push(this.name);
        return closeDone;
      }
    },
  },
});
const constants = await import("../../../app/config/constants");
mock.module("../../../app/config/constants", {
  // Differs from the real value (10), so the worker has to read the constant.
  namedExports: { ...constants, MARKET_SYNC_MAX_CONCURRENT_SHOPS: 7 },
});
mock.module("../../../app/config/redis", {
  namedExports: { bullmqConnection: {} },
});
const takeMarketSyncScope = mock.fn<(shop: string) => Promise<string | null>>(
  async () => null,
);
mock.module("../../../app/services/queue", {
  namedExports: {
    DB_CLEANER_CRON_JOB_NAME: "db-cleaner-tick",
    MARKET_SYNC_CRON_JOB_NAME: "market-sync-tick",
    PRODUCT_WEBHOOK_QUEUE_NAME: "product-webhook",
    SHOP_PUBLIC_KEY_QUEUE_NAME: "shop-public-key",
    WEBHOOK_EVENT_QUEUE_NAME: "webhook-events",
    enqueueMarketSyncTaskForShopUrl: async () => 0,
    enqueueMarketSyncTasks: async () => 0,
    registerDbCleanerCron: async () => {},
    registerMarketSyncCron: async () => {},
    takeMarketSyncScope,
  },
});
const bulkDeleteEventsData = mock.fn(async () => {});
const deleteOlderThan = mock.fn(async (_date: Date) => 0);
mock.module("../../../app/repositories/repositories.server", {
  namedExports: {
    eventDataRepository: { bulkDeleteEventsData },
    tmpMarketSyncRepository: { deleteOlderThan },
    shopRepository: { getShop: async () => shopData },
    customerSyncLogRepository: {
      getCustomerSyncLogByShop: customerLog.get,
      createOrUpdateCustomerSyncLog: customerLog.set,
    },
    orderSyncLogRepository: {
      getOrderSyncLogByShop: orderLog.get,
      createOrUpdateOrderSyncLog: orderLog.set,
    },
    productVariantSyncLogRepository: {
      getProductVariantSyncLogByShop: productLog.get,
      createOrUpdateProductVariantSyncLog: productLog.set,
    },
  },
});
mock.module("../../../app/services/migrate-offline-token.server", {
  namedExports: { migrateOfflineTokenToExpiring: async () => "skipped" },
});
const ADMIN = {};
const unauthenticatedAdmin = mock.fn<(shop: string) => Promise<{ admin: object }>>(
  async () => ({ admin: ADMIN }),
);
mock.module("../../../app/shopify.server", {
  namedExports: { unauthenticated: { admin: unauthenticatedAdmin } },
});
const ensureShopPublicApiKey = mock.fn<(args: unknown) => Promise<void>>(async () => {});
mock.module("../../../app/services/ensure-shop-public-api-key.server", {
  namedExports: { ensureShopPublicApiKey },
});
mock.module("../../../app/worker/services/offline-token-manager", {
  namedExports: {
    createOfflineTokenManager: () => ({
      getAccessToken: async () => accessToken,
    }),
  },
});
mock.module("../../../app/worker/handlers/customer-sync-handler", {
  namedExports: { customerSyncHandler: () => customerSyncHandler() },
});
mock.module("../../../app/worker/handlers/order-sync-handler", {
  namedExports: {
    orderSyncHandler: async () => orderLog.set({ status: "COMPLETE" }),
  },
});
mock.module("../../../app/worker/handlers/product-sync-handler", {
  namedExports: {
    productSyncHandler: async () => productLog.set({ status: "COMPLETE" }),
  },
});
const marketSyncHandler = mock.fn<(...args: unknown[]) => Promise<void>>(async () => {});
mock.module("../../../app/worker/handlers/market-sync-handler", {
  namedExports: { marketSyncHandler },
});
mock.module("../../../app/worker/handlers/product-webhook-handler", {
  namedExports: { productWebhookHandler: async () => {} },
});
const webhookEventHandler = mock.fn(async (_data: unknown) => {});
mock.module("../../../app/worker/handlers/webhook-event-handler", {
  namedExports: { webhookEventHandler },
});

mock.method(console, "log", () => {});
mock.method(console, "error", () => {});

await import("../../../app/worker/worker");
const runDataSync = (kinds?: Kind[]) =>
  processors.get("data-sync")!({ data: { shop: "demo.myshopify.com", kinds } });

beforeEach(() => {
  statuses.customer = "IN_PROGRESS";
  statuses.order = "IN_PROGRESS";
  statuses.product = "IN_PROGRESS";
  errorWrites.length = 0;
  shopData = { id: 1, apiKey: "key" };
  accessToken = "token";
  customerSyncHandler = async () => {
    await customerLog.set({ status: "COMPLETE" });
  };
});

test("no offline token: IN_PROGRESS logs of the job's kinds become ERROR", async () => {
  accessToken = null;
  statuses.order = "COMPLETE";

  await runDataSync(["customer", "order", "product"]);

  assert.deepEqual(errorWrites, ["customer", "product"]);
  assert.equal(statuses.order, "COMPLETE");
});

test("no Yespo API key: default kinds (customer, order) become ERROR", async () => {
  shopData = { id: 1, apiKey: "" };

  await runDataSync();

  assert.deepEqual(errorWrites, ["customer", "order"]);
  assert.equal(statuses.product, "IN_PROGRESS");
});

test("handler throws: later kinds become ERROR, finished kind is kept", async () => {
  customerSyncHandler = async () => {
    await customerLog.set({ status: "ERROR" });
    throw new Error("boom");
  };

  await runDataSync(["customer", "order", "product"]);

  // customer: only the handler's own write; order/product: the worker's.
  assert.deepEqual(errorWrites, ["customer", "order", "product"]);
});

test("successful run writes no ERROR", async () => {
  await runDataSync(["customer", "order", "product"]);

  assert.deepEqual(errorWrites, []);
  assert.deepEqual(statuses, {
    customer: "COMPLETE",
    order: "COMPLETE",
    product: "COMPLETE",
  });
});

test("db-cleaner-tick deletes expired EventData and TmpMarketSync rows older than 24 hours", async () => {
  const before = Date.now();
  await processors.get("cron-jobs")!({ name: "db-cleaner-tick", data: {} });
  const after = Date.now();

  assert.equal(bulkDeleteEventsData.mock.callCount(), 1);
  assert.equal(deleteOlderThan.mock.callCount(), 1);
  const cutoff = deleteOlderThan.mock.calls[0].arguments[0].getTime();
  const day = 24 * 60 * 60 * 1000;
  assert.ok(cutoff >= before - day && cutoff <= after - day);
});

test("MARKET_SYNC_MAX_CONCURRENT_SHOPS (10) limits only the data-sync-market worker", () => {
  assert.equal(constants.MARKET_SYNC_MAX_CONCURRENT_SHOPS, 10);
  assert.deepEqual(Object.fromEntries(concurrencies), {
    "cron-jobs": 1,
    "data-sync": 10,
    "data-sync-market": 7,
    "product-webhook": 1,
    "shop-public-key": 5,
    "token-migration": 5,
    "webhook-events": 5,
  });
});

const runMarketSync = (job: { data: unknown; [key: string]: unknown }) =>
  processors.get("data-sync-market")!(job);
const syncedMarket = () => marketSyncHandler.mock.calls.at(-1)?.arguments[6];

test("market sync job: syncs the market taken from the scope", async () => {
  takeMarketSyncScope.mock.mockImplementationOnce(
    async () => "gid://shopify/Market/1",
  );

  await runMarketSync({ data: { shop: "demo.myshopify.com" }, stalledCounter: 0 });

  assert.deepEqual(takeMarketSyncScope.mock.calls.at(-1)?.arguments, ["demo.myshopify.com"]);
  assert.equal(syncedMarket(), "gid://shopify/Market/1");
});

test("market sync job: an empty scope is a full run, a market in the data of an old job is ignored", async () => {
  await runMarketSync({
    data: { shop: "demo.myshopify.com", marketId: "gid://shopify/Market/1" },
    stalledCounter: 0,
  });

  assert.equal(syncedMarket(), null);
});

test("market sync job restarted after a crash: full run, its first scope is already taken", async () => {
  takeMarketSyncScope.mock.mockImplementationOnce(
    async () => "gid://shopify/Market/2",
  );

  await runMarketSync({ data: { shop: "demo.myshopify.com" }, stalledCounter: 1 });

  assert.equal(syncedMarket(), null);
});

test("market sync job: the scope is taken before the session check", async () => {
  accessToken = null;
  takeMarketSyncScope.mock.resetCalls();
  marketSyncHandler.mock.resetCalls();

  await runMarketSync({ data: { shop: "demo.myshopify.com" }, stalledCounter: 0 });

  assert.equal(takeMarketSyncScope.mock.callCount(), 1);
  assert.equal(marketSyncHandler.mock.callCount(), 0);
});

test("webhook-events job: handler gets job.data; a failure is logged without the payload and rethrown", async () => {
  const data = { shop: "demo.myshopify.com", topic: "CUSTOMERS_UPDATE", payload: { email: "a@example.com" } };
  const job = { name: "CUSTOMERS_UPDATE", data, attemptsMade: 1, opts: { attempts: 5 } };

  await processors.get("webhook-events")!(job);
  assert.deepEqual(webhookEventHandler.mock.calls[0].arguments, [data]);

  const errors: unknown[][] = [];
  const consoleError = mock.method(console, "error", (...args: unknown[]) => {
    errors.push(args);
  });
  webhookEventHandler.mock.mockImplementationOnce(async () => {
    throw new Error("HTTP 503");
  });

  await assert.rejects(processors.get("webhook-events")!(job), /HTTP 503/);
  consoleError.mock.restore();
  mock.method(console, "error", () => {});

  assert.deepEqual(errors, [
    ["[webhook-event] CUSTOMERS_UPDATE for demo.myshopify.com failed (attempt 2/5):", "HTTP 503"],
  ]);
});

const runPublicKey = (data: unknown) =>
  processors.get("shop-public-key")!({
    name: "create-public-key",
    data,
    attemptsMade: 0,
    opts: { attempts: 5 },
  });

test("shop-public-key job: writes the key of the shop with its offline session, returns nothing", async () => {
  shopData = { id: 1, apiKey: "key", shopId: "gid://shopify/Shop/42" };

  assert.equal(await runPublicKey({ shop: "demo.myshopify.com" }), undefined);

  assert.deepEqual(unauthenticatedAdmin.mock.calls[0].arguments, ["demo.myshopify.com"]);
  assert.deepEqual(
    ensureShopPublicApiKey.mock.calls.map((call) => call.arguments),
    [[{ admin: ADMIN, shopUrl: "demo.myshopify.com", shopGid: "gid://shopify/Shop/42" }]],
  );
});

test("shop-public-key job: a shop without a session or a row is skipped, not retried", async () => {
  shopData = { id: 1, apiKey: "key", shopId: "gid://shopify/Shop/42" };
  ensureShopPublicApiKey.mock.resetCalls();
  unauthenticatedAdmin.mock.mockImplementationOnce(async () => {
    throw new SessionNotFoundError("no session");
  });

  await runPublicKey({ shop: "demo.myshopify.com" });
  shopData = null;
  await runPublicKey({ shop: "demo.myshopify.com" });

  assert.equal(ensureShopPublicApiKey.mock.callCount(), 0);
});

test("shop-public-key job: any other failure is logged and rethrown for a retry", async () => {
  shopData = { id: 1, apiKey: "key", shopId: "gid://shopify/Shop/42" };
  const errors: unknown[][] = [];
  const consoleError = mock.method(console, "error", (...args: unknown[]) => {
    errors.push(args);
  });

  unauthenticatedAdmin.mock.mockImplementationOnce(async () => {
    throw new Error("refresh failed");
  });
  await assert.rejects(runPublicKey({ shop: "demo.myshopify.com" }), /refresh failed/);
  ensureShopPublicApiKey.mock.mockImplementationOnce(async () => {
    throw new Error("Throttled");
  });
  await assert.rejects(runPublicKey({ shop: "demo.myshopify.com" }), /Throttled/);
  // The SDK throws a Response when the token refresh fails.
  const refreshFailure = new Response(undefined, { status: 500 });
  unauthenticatedAdmin.mock.mockImplementationOnce(async () => {
    throw refreshFailure;
  });
  await assert.rejects(
    runPublicKey({ shop: "demo.myshopify.com" }),
    (error) => error === refreshFailure,
  );
  consoleError.mock.restore();
  mock.method(console, "error", () => {});

  assert.deepEqual(errors, [
    ["[shop-public-key] demo.myshopify.com failed (attempt 1/5):", "refresh failed"],
    ["[shop-public-key] demo.myshopify.com failed (attempt 1/5):", "Throttled"],
    ["[shop-public-key] demo.myshopify.com failed (attempt 1/5):", "HTTP 500"],
  ]);
});

test("SIGTERM twice: every worker closed once, exit(0) once after close resolves", async (t) => {
  const exit = t.mock.method(process, "exit", () => undefined as never);
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  process.emit("SIGTERM");
  process.emit("SIGTERM");
  await flush();

  assert.deepEqual(closedQueues.sort(), [
    "cron-jobs",
    "data-sync",
    "data-sync-market",
    "product-webhook",
    "shop-public-key",
    "token-migration",
    "webhook-events",
  ]);
  assert.equal(exit.mock.callCount(), 0);

  finishClose();
  await flush();

  assert.equal(exit.mock.callCount(), 1);
  assert.deepEqual(exit.mock.calls[0].arguments, [0]);
});
