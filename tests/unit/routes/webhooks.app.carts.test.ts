import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const SHOP = "demo.myshopify.com";
const payload = { token: "cart-1" };

let session: { shop: string } | undefined;
let store: Record<string, unknown> | null = {};

const enqueueWebhookEvent = mock.fn(async (..._args: unknown[]) => {});

mock.module("../../../app/shopify.server", {
  namedExports: {
    authenticate: {
      webhook: async () => ({ topic: "CARTS_UPDATE", session, payload, webhookId: "wh-1" }),
    },
  },
});
mock.module("../../../app/repositories/repositories.server", {
  namedExports: { shopRepository: { getShop: async () => store } },
});
mock.module("../../../app/services/queue", {
  namedExports: { enqueueWebhookEvent },
});

mock.method(console, "log", () => {});

const { action } = await import("../../../app/routes/webhooks.app.carts");

const send = () =>
  action({
    request: new Request("https://app.example/webhooks/app/carts", { method: "POST" }),
  } as Parameters<typeof action>[0]);

beforeEach(() => {
  enqueueWebhookEvent.mock.resetCalls();
  session = { shop: SHOP };
  store = { id: 3, apiKey: "key", isWebTrackingEnabled: true };
});

test("CARTS_UPDATE is queued and answered with 200 when web tracking is enabled", async () => {
  const response = await send();

  assert.equal(response.status, 200);
  assert.equal(enqueueWebhookEvent.mock.callCount(), 1);
  assert.deepEqual(enqueueWebhookEvent.mock.calls[0].arguments, [
    { shop: SHOP, topic: "CARTS_UPDATE", payload },
    "wh-1",
  ]);
});

for (const [name, setup] of [
  ["web tracking false", () => { store = { ...store, isWebTrackingEnabled: false }; }],
  ["web tracking null", () => { store = { ...store, isWebTrackingEnabled: null }; }],
  ["no session", () => { session = undefined; }],
  ["shop not found", () => { store = null; }],
  ["no API key", () => { store = { ...store, apiKey: null }; }],
] as const) {
  test(`${name}: 200 without queueing`, async () => {
    setup();

    const response = await send();

    assert.equal(response.status, 200);
    assert.equal(enqueueWebhookEvent.mock.callCount(), 0);
  });
}

test("queueing error is thrown so Shopify retries the delivery", async () => {
  enqueueWebhookEvent.mock.mockImplementationOnce(async () => {
    throw new Error("READONLY");
  });

  await assert.rejects(send(), /READONLY/);
});
