import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

type Kind = "customer" | "order" | "product";
type Processor = (job: { data: unknown; [key: string]: unknown }) => Promise<unknown>;

const processors = new Map<string, Processor>();
const statuses: Partial<Record<Kind, string>> = {};
const errorWrites: Kind[] = [];
let shopData: { id: number; apiKey: string } | null = null;
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
      ) {
        processors.set(name, processor);
      }
      on() {}
      close() {
        closedQueues.push(this.name);
        return closeDone;
      }
    },
  },
});
mock.module("../../../app/config/redis", {
  namedExports: { bullmqConnection: {} },
});
mock.module("../../../app/services/queue", {
  namedExports: {
    DB_CLEANER_CRON_JOB_NAME: "db-cleaner-tick",
    MARKET_SYNC_CRON_JOB_NAME: "market-sync-tick",
    PRODUCT_WEBHOOK_QUEUE_NAME: "product-webhook",
    WEBHOOK_EVENT_QUEUE_NAME: "webhook-events",
    enqueueMarketSyncTaskForShopUrl: async () => 0,
    enqueueMarketSyncTasks: async () => 0,
    registerDbCleanerCron: async () => {},
    registerMarketSyncCron: async () => {},
  },
});
mock.module("../../../app/repositories/repositories.server", {
  namedExports: {
    eventDataRepository: {},
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
mock.module("../../../app/worker/handlers/market-sync-handler", {
  namedExports: { marketSyncHandler: async () => {} },
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
    "token-migration",
    "webhook-events",
  ]);
  assert.equal(exit.mock.callCount(), 0);

  finishClose();
  await flush();

  assert.equal(exit.mock.callCount(), 1);
  assert.deepEqual(exit.mock.calls[0].arguments, [0]);
});
