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

const { getMarketVariantPrices } = await import(
  "../../../app/services/get-market-variant-prices.server"
);

const run = () =>
  getMarketVariantPrices({
    shopUrl: "demo.myshopify.com",
    variantIds: ["1"],
    marketId: "de",
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

test("returns no prices and sends no request without an offline token", async () => {
  token = null;

  const prices = await run();

  assert.equal(prices.size, 0);
  assert.equal(createClient.mock.callCount(), 0);
  assert.equal(request.mock.callCount(), 0);
});
