import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import type { OrderCreatePayload } from "../../../app/@types/order";

const createOrUpdateOrderSync = mock.fn(async (_data: unknown) => ({}));
let createOrdersResponse: unknown = {};

mock.module("../../../app/api/create-orders", {
  namedExports: { createOrders: async () => createOrdersResponse },
});
mock.module("../../../app/repositories/repositories.server", {
  namedExports: {
    eventDataRepository: { getEventData: async () => null },
    orderSyncRepository: { createOrUpdateOrderSync },
  },
});
mock.module("../../../app/services/get-order-item-products.server", {
  namedExports: { getOrderItemProducts: async () => new Map() },
});

const { updateOrderService } = await import(
  "../../../app/services/update-order.server"
);

const payload = {
  id: 1,
  admin_graphql_api_id: "gid://shopify/Order/1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  email: "a@b.c",
  line_items: [],
} as unknown as OrderCreatePayload;

const run = () => updateOrderService(payload, "key", 1, "demo.com");

beforeEach(() => {
  createOrUpdateOrderSync.mock.resetCalls();
});

test("does not record OrderSync when Yespo rejects the order", async () => {
  createOrdersResponse = { failedOrders: [{ order: {}, error: "x" }] };

  await run();

  assert.equal(createOrUpdateOrderSync.mock.callCount(), 0);
});

test("records OrderSync when failedOrders is empty", async () => {
  createOrdersResponse = { failedOrders: [] };

  await run();

  assert.equal(createOrUpdateOrderSync.mock.callCount(), 1);
});
