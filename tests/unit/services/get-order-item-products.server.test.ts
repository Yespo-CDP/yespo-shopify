import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

let token: string | null = "offline-token";
const tokenManager = { getAccessToken: async () => token };
const createOfflineTokenManager = mock.fn((_shop: string) => tokenManager);
const request = mock.fn(async () => ({ data: { nodes: [] } }));
const createClient = mock.fn((_params: unknown) => ({ request }));

mock.module("../../../app/worker/services/offline-token-manager", {
  namedExports: { createOfflineTokenManager },
});
mock.module("../../../app/services/get-offline-session.server", {
  namedExports: { getOfflineAccessToken: async () => "session-token" },
});
mock.module("../../../app/worker/services/create-client", {
  namedExports: { createClient },
});

const { getOrderItemProducts } = await import(
  "../../../app/services/get-order-item-products.server"
);

const run = () =>
  getOrderItemProducts({
    shopUrl: "demo.myshopify.com",
    shopDomain: "shop.example",
    variantIds: ["1"],
  });

beforeEach(() => {
  token = "offline-token";
  createOfflineTokenManager.mock.resetCalls();
  createClient.mock.resetCalls();
  request.mock.resetCalls();
});

test("creates the client with the shop's offline token manager", async () => {
  await run();

  assert.deepEqual(createOfflineTokenManager.mock.calls[0]?.arguments, [
    "demo.myshopify.com",
  ]);
  assert.deepEqual(createClient.mock.calls[0]?.arguments[0], {
    shop: "demo.myshopify.com",
    accessToken: "offline-token",
    tokenManager,
  });
  assert.equal(request.mock.callCount(), 1);
});

test("returns no links and sends no request without an offline token", async () => {
  token = null;

  const links = await run();

  assert.equal(links.size, 0);
  assert.equal(createClient.mock.callCount(), 0);
  assert.equal(request.mock.callCount(), 0);
});
