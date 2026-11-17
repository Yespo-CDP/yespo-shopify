import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const orders = [1, 2, 3].map((id) => ({
  id: `gid://shopify/Order/${id}`,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
}));

const createOrUpdateOrderSync = mock.fn(async (_data: unknown) => ({}));
let createOrders = mock.fn(async (_args: unknown): Promise<unknown> => ({}));

mock.module("../../../../app/repositories/repositories.server", {
  namedExports: {
    shopRepository: {
      getShop: async () => ({ domain: "demo.com", isOrderSyncEnabled: true }),
    },
    orderSyncRepository: {
      getOrderSyncByOrderIds: async () => [],
      createOrUpdateOrderSync,
    },
    orderSyncLogRepository: { createOrUpdateOrderSyncLog: async () => ({}) },
  },
});
mock.module("../../../../app/api/create-orders", {
  namedExports: { createOrders: (args: unknown) => createOrders(args) },
});
mock.module("../../../../app/worker/services/create-client", {
  namedExports: { createClient: () => ({}) },
});
mock.module("../../../../app/worker/services/get-orders", {
  namedExports: { getOrders: async () => ({ orders, cursor: null }) },
});
mock.module("../../../../app/worker/services/get-orders-count", {
  namedExports: { getOrdersCount: async () => orders.length },
});
mock.module("../../../../app/worker/services/create-order-payload", {
  namedExports: {
    createOrderPayload: (order: { id: string }) => ({
      externalOrderId: order.id.split("/").pop(),
    }),
  },
});
mock.module("../../../../app/api/send-log-event", {
  namedExports: { sendLogEvent: async () => {} },
});

const { orderSyncHandler } = await import(
  "../../../../app/worker/handlers/order-sync-handler"
);

const markedIds = () =>
  createOrUpdateOrderSync.mock.calls.map(
    (call) => (call.arguments[0] as { orderId: string }).orderId,
  );

beforeEach(() => {
  createOrUpdateOrderSync.mock.resetCalls();
});

test("rejected order gets no sync marker", async () => {
  createOrders = mock.fn(async () => ({
    failedOrders: [{ order: { externalOrderId: "2" }, error: "x" }],
  }));

  await orderSyncHandler("demo.myshopify.com", "token", "key", 1);

  assert.deepEqual(markedIds(), ["gid://shopify/Order/1", "gid://shopify/Order/3"]);
});

test("no sync marker when Yespo request throws", async () => {
  createOrders = mock.fn(async () => {
    throw new Error("502");
  });

  await orderSyncHandler("demo.myshopify.com", "token", "key", 1);

  assert.equal(createOrders.mock.callCount(), 1);
  assert.equal(createOrUpdateOrderSync.mock.callCount(), 0);
});
