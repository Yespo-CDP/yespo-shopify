import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const SHOP = "demo.myshopify.com";
const orderPayload = { id: 1, note_attributes: [], line_items: [] };
const cartPayload = { token: "cart-1" };
const customerPayload = { id: 7, email: "a@example.com" };

let purchasedItemsSent = false;
let store: Record<string, unknown> | null = {};

const sendPurchasedItemsService = mock.fn(async (..._args: unknown[]) => purchasedItemsSent);
const updateOrderService = mock.fn(async (..._args: unknown[]) => {});
const sendStatusCartService = mock.fn(async (..._args: unknown[]) => {});
const createContactService = mock.fn(async (..._args: unknown[]) => {});
const updateContactService = mock.fn(async (..._args: unknown[]) => {});
const deleteOrderService = mock.fn<(...args: unknown[]) => Promise<void>>(async () => {});
const enqueueWebhookEvent = mock.fn<(...args: unknown[]) => Promise<void>>(async () => {});
const services = [
  sendPurchasedItemsService,
  updateOrderService,
  sendStatusCartService,
  createContactService,
  updateContactService,
  deleteOrderService,
  enqueueWebhookEvent,
];

mock.module("../../../../app/repositories/repositories.server", {
  namedExports: { shopRepository: { getShop: async () => store } },
});
mock.module("../../../../app/services/send-purchased-items.server", {
  namedExports: { sendPurchasedItemsService },
});
mock.module("../../../../app/services/update-order.server", {
  namedExports: { updateOrderService },
});
mock.module("../../../../app/services/send-status-cart.server", {
  namedExports: { sendStatusCartService },
});
mock.module("../../../../app/services/create-contact.server", {
  namedExports: { createContactService },
});
mock.module("../../../../app/services/update-contact.service", {
  namedExports: { updateContactService },
});
mock.module("../../../../app/services/delete-order.server", {
  namedExports: { deleteOrderService },
});
mock.module("../../../../app/services/queue", {
  namedExports: { enqueueWebhookEvent },
});

const { webhookEventHandler } = await import(
  "../../../../app/worker/handlers/webhook-event-handler"
);

const run = (topic: string, payload: unknown = orderPayload) =>
  webhookEventHandler({ shop: SHOP, topic, payload });

beforeEach(() => {
  for (const service of services) service.mock.resetCalls();
  store = {
    id: 3,
    apiKey: "key",
    isWebTrackingEnabled: true,
    isOrderSyncEnabled: true,
    isContactSyncEnabled: true,
    domain: "demo.com",
    orgId: 5,
    shopUrl: SHOP,
  };
});

// Orders (tasks 18, 20): moved from tests/unit/routes/webhook.app.orders.test.ts.

test("ORDERS_CREATE does not send the order when PurchasedItems was sent", async () => {
  purchasedItemsSent = true;

  await run("ORDERS_CREATE");

  assert.equal(sendPurchasedItemsService.mock.callCount(), 1);
  assert.deepEqual(sendPurchasedItemsService.mock.calls[0].arguments, [orderPayload, store]);
  assert.equal(updateOrderService.mock.callCount(), 0);
  assert.equal(enqueueWebhookEvent.mock.callCount(), 0);
});

test("ORDERS_CREATE queues the order as ORDERS_UPDATED when PurchasedItems was not sent", async () => {
  purchasedItemsSent = false;

  await run("ORDERS_CREATE");

  assert.equal(sendPurchasedItemsService.mock.callCount(), 1);
  assert.equal(updateOrderService.mock.callCount(), 0);
  assert.equal(enqueueWebhookEvent.mock.callCount(), 1);
  assert.deepEqual(enqueueWebhookEvent.mock.calls[0].arguments, [
    { shop: SHOP, topic: "ORDERS_UPDATED", payload: orderPayload },
    "order-create-1",
  ]);
});

test("ORDERS_CREATE does not queue the order when order sync is disabled", async () => {
  purchasedItemsSent = false;
  store = { ...store, isOrderSyncEnabled: false };

  await run("ORDERS_CREATE");

  assert.equal(updateOrderService.mock.callCount(), 0);
  assert.equal(enqueueWebhookEvent.mock.callCount(), 0);
});

test("ORDERS_CREATE does not send PurchasedItems but queues the order when web tracking is disabled", async () => {
  purchasedItemsSent = true;
  store = { ...store, isWebTrackingEnabled: false };

  await run("ORDERS_CREATE");

  assert.equal(sendPurchasedItemsService.mock.callCount(), 0);
  assert.equal(updateOrderService.mock.callCount(), 0);
  assert.equal(enqueueWebhookEvent.mock.callCount(), 1);
});

test("ORDERS_CREATE fails when the order job cannot be queued", async () => {
  purchasedItemsSent = false;
  enqueueWebhookEvent.mock.mockImplementationOnce(async () => {
    throw new Error("redis down");
  });

  await assert.rejects(run("ORDERS_CREATE"), /redis down/);
});

test("ORDERS_UPDATED sends the order when order sync is enabled", async () => {
  await run("ORDERS_UPDATED");

  assert.equal(updateOrderService.mock.callCount(), 1);
  assert.deepEqual(updateOrderService.mock.calls[0].arguments, [orderPayload, "key", 3, "demo.com", 5, SHOP]);
  assert.equal(enqueueWebhookEvent.mock.callCount(), 0);
});

test("ORDERS_UPDATED does not send the order when order sync is disabled", async () => {
  store = { ...store, isOrderSyncEnabled: false };

  await run("ORDERS_UPDATED");

  assert.equal(updateOrderService.mock.callCount(), 0);
});

// Order deletion (task 44).

test("ORDERS_DELETE deletes the order when order sync is enabled", async () => {
  await run("ORDERS_DELETE", { id: 1 });

  assert.equal(deleteOrderService.mock.callCount(), 1);
  assert.deepEqual(deleteOrderService.mock.calls[0].arguments, ["1", store]);
});

test("ORDERS_DELETE does nothing when order sync is disabled", async () => {
  store = { ...store, isOrderSyncEnabled: false };

  await run("ORDERS_DELETE", { id: 1 });

  assert.equal(deleteOrderService.mock.callCount(), 0);
});

// Carts (task 20): moved from tests/unit/routes/webhooks.app.carts.test.ts.

for (const isWebTrackingEnabled of [false, null]) {
  test(`CARTS_UPDATE does not send StatusCart when web tracking is ${isWebTrackingEnabled}`, async () => {
    store = { ...store, isWebTrackingEnabled };

    await run("CARTS_UPDATE", cartPayload);

    assert.equal(sendStatusCartService.mock.callCount(), 0);
  });
}

test("CARTS_UPDATE sends StatusCart when web tracking is enabled", async () => {
  await run("CARTS_UPDATE", cartPayload);

  assert.equal(sendStatusCartService.mock.callCount(), 1);
  assert.deepEqual(sendStatusCartService.mock.calls[0].arguments, [cartPayload, store]);
});

// Customers: same arguments as the route passed before.

test("CUSTOMERS_CREATE and CUSTOMERS_UPDATE call the contact services with the route's arguments", async () => {
  await run("CUSTOMERS_CREATE", customerPayload);
  await run("CUSTOMERS_UPDATE", customerPayload);

  const expected = [customerPayload, "key", 3, "demo.com", 5, SHOP];
  assert.deepEqual(createContactService.mock.calls[0].arguments, expected);
  assert.deepEqual(updateContactService.mock.calls[0].arguments, expected);
});

test("CUSTOMERS_* do nothing when contact sync is disabled", async () => {
  store = { ...store, isContactSyncEnabled: false };

  await run("CUSTOMERS_CREATE", customerPayload);
  await run("CUSTOMERS_UPDATE", customerPayload);

  assert.equal(createContactService.mock.callCount(), 0);
  assert.equal(updateContactService.mock.callCount(), 0);
});

for (const [topic, service] of [
  ["CUSTOMERS_CREATE", createContactService],
  ["CUSTOMERS_UPDATE", updateContactService],
  ["ORDERS_UPDATED", updateOrderService],
] as const) {
  test(`${topic} error is rethrown so the job is retried`, async () => {
    service.mock.mockImplementationOnce(async () => {
      throw new Error("HTTP 503");
    });

    await assert.rejects(run(topic, customerPayload), /HTTP 503/);
  });
}

// Shop read at processing time.

for (const [name, shop] of [
  ["missing", null],
  ["without API key", { apiKey: null }],
] as const) {
  test(`shop ${name}: nothing is sent`, async () => {
    store = shop ? { ...store, ...shop } : null;

    for (const topic of ["CUSTOMERS_CREATE", "CUSTOMERS_UPDATE", "ORDERS_CREATE", "ORDERS_UPDATED", "ORDERS_DELETE", "CARTS_UPDATE"]) {
      await run(topic);
    }

    for (const service of services) assert.equal(service.mock.callCount(), 0);
  });
}

test("unknown topic: nothing is sent", async (t) => {
  t.mock.method(console, "warn", () => {});

  await run("PRODUCTS_UPDATE");

  for (const service of services) assert.equal(service.mock.callCount(), 0);
});
