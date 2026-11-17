import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const SHOP = "demo.myshopify.com";
const payload = { id: 7, email: "a@example.com" };

let topic = "";
let session: { shop: string } | undefined;
let store: Record<string, unknown> | null = {};

const enqueueWebhookEvent = mock.fn(async (..._args: unknown[]) => {});

mock.module("../../../app/shopify.server", {
  namedExports: {
    authenticate: {
      webhook: async () => ({ topic, session, payload, webhookId: "wh-1" }),
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

const { action } = await import("../../../app/routes/webhooks.app.customers");

const send = (webhookTopic: string) => {
  topic = webhookTopic;
  return action({
    request: new Request("https://app.example/webhooks/app/customers", { method: "POST" }),
  } as Parameters<typeof action>[0]);
};

beforeEach(() => {
  enqueueWebhookEvent.mock.resetCalls();
  session = { shop: SHOP };
  store = { id: 3, apiKey: "key", isContactSyncEnabled: true };
});

for (const webhookTopic of ["CUSTOMERS_CREATE", "CUSTOMERS_UPDATE"]) {
  test(`${webhookTopic} is queued and answered with 200`, async () => {
    const response = await send(webhookTopic);

    assert.equal(response.status, 200);
    assert.equal(enqueueWebhookEvent.mock.callCount(), 1);
    assert.deepEqual(enqueueWebhookEvent.mock.calls[0].arguments, [
      { shop: SHOP, topic: webhookTopic, payload },
      "wh-1",
    ]);
  });
}

for (const [name, setup] of [
  ["contact sync disabled", () => { store = { ...store, isContactSyncEnabled: false }; }],
  ["no session", () => { session = undefined; }],
  ["shop not found", () => { store = null; }],
  ["no API key", () => { store = { ...store, apiKey: null }; }],
] as const) {
  test(`${name}: 200 without queueing`, async () => {
    setup();

    const response = await send("CUSTOMERS_UPDATE");

    assert.equal(response.status, 200);
    assert.equal(enqueueWebhookEvent.mock.callCount(), 0);
  });
}

test("queueing error is thrown so Shopify retries the delivery", async () => {
  enqueueWebhookEvent.mock.mockImplementationOnce(async () => {
    throw new Error("READONLY");
  });

  await assert.rejects(send("CUSTOMERS_CREATE"), /READONLY/);
});
