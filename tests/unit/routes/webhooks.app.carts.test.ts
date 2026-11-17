import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const SHOP = "demo.myshopify.com";
const payload = { token: "cart-1" };

let store: Record<string, unknown> = {};

const sendStatusCartService = mock.fn(async (..._args: unknown[]) => {});

mock.module("../../../app/shopify.server", {
  namedExports: {
    authenticate: {
      webhook: async () => ({ topic: "CARTS_UPDATE", session: { shop: SHOP }, payload, webhookId: "wh-1" }),
    },
  },
});
mock.module("../../../app/repositories/repositories.server", {
  namedExports: { shopRepository: { getShop: async () => store } },
});
mock.module("../../../app/services/send-status-cart.server", {
  namedExports: { sendStatusCartService },
});

const { action } = await import("../../../app/routes/webhooks.app.carts");

const send = () =>
  action({
    request: new Request("https://app.example/webhooks/app/carts", { method: "POST" }),
  } as Parameters<typeof action>[0]);

beforeEach(() => {
  sendStatusCartService.mock.resetCalls();
  store = { id: 3, apiKey: "key" };
});

for (const isWebTrackingEnabled of [false, null]) {
  test(`CARTS_UPDATE does not send StatusCart when web tracking is ${isWebTrackingEnabled}`, async () => {
    store = { ...store, isWebTrackingEnabled };

    const response = await send();

    assert.equal(response.status, 200);
    assert.equal(sendStatusCartService.mock.callCount(), 0);
  });
}

test("CARTS_UPDATE sends StatusCart when web tracking is enabled", async () => {
  store = { ...store, isWebTrackingEnabled: true };

  const response = await send();

  assert.equal(response.status, 200);
  assert.equal(sendStatusCartService.mock.callCount(), 1);
  assert.deepEqual(sendStatusCartService.mock.calls[0].arguments, [payload, store]);
});
