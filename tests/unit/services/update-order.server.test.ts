import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import type { Order, OrderCreatePayload } from "../../../app/@types/order";

const STORED = new Date("2026-01-02T00:00:00Z");
let stored: { updatedAt: Date | null }[] = [];
const getOrderSyncByOrderIds = mock.fn<
  (shopId: number, ids: string[]) => Promise<typeof stored>
>(async () => stored);
const getOrderItemProducts = mock.fn(async () => new Map());
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
    orderSyncRepository: { getOrderSyncByOrderIds, createOrUpdateOrderSync },
  },
});
mock.module("../../../app/services/get-order-item-products.server", {
  namedExports: { getOrderItemProducts },
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

const run = (data: unknown = payload, fromOrderCreate?: boolean) =>
  updateOrderService(
    data as OrderCreatePayload,
    "key",
    1,
    "demo.com",
    undefined,
    undefined,
    fromOrderCreate,
  );

const yespoFails = (status?: number) =>
  createOrders.mock.mockImplementationOnce(async () => {
    throw Object.assign(new Error(`HTTP ${status}`), status ? { status } : {});
  });

mock.method(console, "log", () => {});
mock.method(console, "error", () => {});

beforeEach(() => {
  stored = [];
  createOrdersResponse = {};
  getOrderSyncByOrderIds.mock.resetCalls();
  getOrderItemProducts.mock.resetCalls();
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

// Retries and stale payloads (improv2 task 03).

for (const status of [429, 500, 503, undefined]) {
  test(`Yespo error with status ${status} is thrown without a marker`, async () => {
    yespoFails(status);

    await assert.rejects(run(), new RegExp(`HTTP ${status}`));

    assert.equal(createOrUpdateOrderSync.mock.callCount(), 0);
  });
}

for (const status of [400, 401, 409]) {
  test(`Yespo error with status ${status} is not thrown and leaves no marker`, async () => {
    yespoFails(status);

    await run();

    assert.equal(createOrders.mock.callCount(), 1);
    assert.equal(createOrUpdateOrderSync.mock.callCount(), 0);
  });
}

test("failed marker write is thrown so the job is retried", async () => {
  createOrUpdateOrderSync.mock.mockImplementationOnce(async () => {
    throw new Error("db down");
  });

  await assert.rejects(run(), /db down/);
});

test("stored OrderSync is newer: nothing is sent or requested", async () => {
  stored = [{ updatedAt: new Date(STORED.getTime() + 1000) }];

  await run();

  assert.equal(getOrderItemProducts.mock.callCount(), 0);
  assert.equal(createOrders.mock.callCount(), 0);
  assert.equal(createOrUpdateOrderSync.mock.callCount(), 0);
  assert.deepEqual(getOrderSyncByOrderIds.mock.calls[0].arguments, [
    1,
    [payload.admin_graphql_api_id],
  ]);
});

for (const [name, rows, updatedAt] of [
  ["same date", [{ updatedAt: STORED }], "2026-01-02T00:00:00Z"],
  ["same date in another offset", [{ updatedAt: STORED }], "2026-01-01T19:00:00-05:00"],
  ["older stored date", [{ updatedAt: new Date(0) }], "2026-01-02T00:00:00Z"],
  ["stored row without a date", [{ updatedAt: null }], "2026-01-02T00:00:00Z"],
  ["no stored row", [], "2026-01-02T00:00:00Z"],
  ["updated_at null", [{ updatedAt: STORED }], null],
  ["updated_at missing", [{ updatedAt: STORED }], undefined],
  ["updated_at invalid", [{ updatedAt: STORED }], "not a date"],
] as const) {
  test(`${name}: the order is sent`, async () => {
    stored = [...rows];

    await run({ ...payload, updated_at: updatedAt });

    assert.equal(createOrders.mock.callCount(), 1);
    assert.equal(createOrUpdateOrderSync.mock.callCount(), 1);
  });
}

// The order of an orders/create job is always the oldest state of the order.
for (const [name, rows, updatedAt, sent] of [
  ["same date", [{ updatedAt: STORED }], "2026-01-02T00:00:00Z", 0],
  ["newer stored date", [{ updatedAt: new Date(STORED.getTime() + 1) }], "2026-01-02T00:00:00Z", 0],
  ["older stored date", [{ updatedAt: new Date(STORED.getTime() - 1) }], "2026-01-02T00:00:00Z", 1],
  ["stored row without a date", [{ updatedAt: null }], "2026-01-02T00:00:00Z", 1],
  ["no stored row", [], "2026-01-02T00:00:00Z", 1],
  ["updated_at missing", [{ updatedAt: STORED }], undefined, 1],
] as const) {
  test(`order of orders/create, ${name}: ${sent ? "sent" : "skipped"}`, async () => {
    stored = [...rows];

    await run({ ...payload, updated_at: updatedAt }, true);

    assert.equal(createOrders.mock.callCount(), sent);
    assert.equal(createOrUpdateOrderSync.mock.callCount(), sent);
  });
}

test("order of orders/create is sent again when its marker was not written", async () => {
  createOrUpdateOrderSync.mock.mockImplementationOnce(async () => {
    throw new Error("db down");
  });

  await assert.rejects(run(payload, true), /db down/);
  await run(payload, true);

  assert.equal(createOrders.mock.callCount(), 2);
  assert.equal(createOrUpdateOrderSync.mock.callCount(), 2);
});

test("failed OrderSync read is thrown and nothing is sent", async () => {
  getOrderSyncByOrderIds.mock.mockImplementationOnce(async () => {
    throw new Error("db down");
  });

  await assert.rejects(run(), /db down/);

  assert.equal(createOrders.mock.callCount(), 0);
});
