import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const SHOP = "demo.myshopify.com";
const payload = { id: 1, note_attributes: [], line_items: [] };

let topic = "";
let purchasedItemsSent = false;
let store: Record<string, unknown> = {};

const sendPurchasedItemsService = mock.fn(async (..._args: unknown[]) => purchasedItemsSent);
const updateOrderService = mock.fn(async (..._args: unknown[]) => {});

mock.module("../../../app/shopify.server", {
  namedExports: {
    authenticate: {
      webhook: async () => ({ topic, session: { shop: SHOP }, payload, webhookId: "wh-1" }),
    },
  },
});
mock.module("../../../app/repositories/repositories.server", {
  namedExports: { shopRepository: { getShop: async () => store } },
});
mock.module("../../../app/services/send-purchased-items.server", {
  namedExports: { sendPurchasedItemsService },
});
mock.module("../../../app/services/update-order.server", {
  namedExports: { updateOrderService },
});

const { action } = await import("../../../app/routes/webhook.app.orders");

const send = (webhookTopic: string) => {
  topic = webhookTopic;
  return action({
    request: new Request("https://app.example/webhook/app/orders", { method: "POST" }),
  } as Parameters<typeof action>[0]);
};

beforeEach(() => {
  sendPurchasedItemsService.mock.resetCalls();
  updateOrderService.mock.resetCalls();
  store = { id: 3, apiKey: "key", isWebTrackingEnabled: true, isOrderSyncEnabled: true, domain: "demo.com", orgId: 5, shopUrl: SHOP };
});

test("ORDERS_CREATE does not send the order when PurchasedItems was sent", async () => {
  purchasedItemsSent = true;

  const response = await send("ORDERS_CREATE");

  assert.equal(response.status, 200);
  assert.equal(sendPurchasedItemsService.mock.callCount(), 1);
  assert.equal(updateOrderService.mock.callCount(), 0);
});

test("ORDERS_CREATE sends the order like ORDERS_UPDATED when PurchasedItems was not sent", async () => {
  purchasedItemsSent = false;

  await send("ORDERS_UPDATED");
  const updatedArgs = updateOrderService.mock.calls[0].arguments;
  updateOrderService.mock.resetCalls();

  const response = await send("ORDERS_CREATE");

  assert.equal(response.status, 200);
  assert.equal(updateOrderService.mock.callCount(), 1);
  assert.deepEqual(updateOrderService.mock.calls[0].arguments, updatedArgs);
  assert.deepEqual(updatedArgs, [payload, "key", 3, "demo.com", 5, SHOP]);
});

test("ORDERS_CREATE does not send the order when order sync is disabled", async () => {
  purchasedItemsSent = false;
  store = { ...store, isOrderSyncEnabled: false };

  await send("ORDERS_CREATE");

  assert.equal(updateOrderService.mock.callCount(), 0);
});

test("ORDERS_CREATE does not send PurchasedItems but sends the order when web tracking is disabled", async () => {
  purchasedItemsSent = true;
  store = { ...store, isWebTrackingEnabled: false };

  const response = await send("ORDERS_CREATE");

  assert.equal(response.status, 200);
  assert.equal(sendPurchasedItemsService.mock.callCount(), 0);
  assert.equal(updateOrderService.mock.callCount(), 1);
  assert.deepEqual(updateOrderService.mock.calls[0].arguments, [payload, "key", 3, "demo.com", 5, SHOP]);
});
