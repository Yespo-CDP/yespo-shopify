import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import type { Order, OrderCreatePayload } from "../../../app/@types/order";

const createOrUpdateOrderSync = mock.fn(async (_data: unknown) => ({}));
let createOrdersResponse: unknown = {};
const createOrders = mock.fn(
  async (_args: { orders: Order[] }) => createOrdersResponse,
);

mock.module("../../../app/api/create-orders", {
  namedExports: { createOrders },
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
  createOrders.mock.resetCalls();
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

test("sends the presentment unit price as item cost", async () => {
  createOrdersResponse = {};

  await updateOrderService(
    {
      ...payload,
      currency: "UAH",
      presentment_currency: "USD",
      line_items: [
        {
          id: 11,
          variant_id: null,
          name: "Shirt",
          quantity: 3,
          price: "400.00",
          price_set: {
            shop_money: { amount: "400.00", currency_code: "UAH" },
            presentment_money: { amount: "10.00", currency_code: "USD" },
          },
        },
      ],
    } as unknown as OrderCreatePayload,
    "key",
    1,
    "demo.com",
  );

  const [order] = createOrders.mock.calls[0].arguments[0].orders;
  assert.equal(order.currency, "USD");
  assert.equal(order.items[0]?.quantity, 3);
  assert.equal(order.items[0]?.cost, 10);
});
