import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const SHOP = "demo.myshopify.com";

let topic = "MARKETS_UPDATE";
let enabledMarketCount = 2;
let enqueueImpl = async () => 1;

const updateShop = mock.fn<(shopUrl: string, data: unknown) => Promise<unknown>>(
  async () => ({}),
);
const enqueueMarketSyncTaskForShopUrl = mock.fn<
  (shopUrl: string, options?: { marketId?: string }) => Promise<number>
>(async () => enqueueImpl());

mock.module("../../../app/shopify.server", {
  namedExports: {
    authenticate: {
      webhook: async () => ({
        topic,
        shop: SHOP,
        session: { shop: SHOP },
        admin: {},
        payload: { admin_graphql_api_id: "gid://shopify/Market/1", status: "active" },
      }),
    },
  },
});
mock.module("../../../app/repositories/repositories.server", {
  namedExports: {
    shopRepository: {
      getShop: async () => ({
        shopUrl: SHOP,
        shopId: "1",
        apiKey: "key",
        isProductVariantSyncEnabled: true,
        isMarketSyncEnabled: true,
      }),
      updateShop,
    },
  },
});
mock.module("../../../app/services/queue", {
  namedExports: { enqueueMarketSyncTaskForShopUrl },
});
mock.module("../../../app/services/sync-market-tracking-metafield.server", {
  namedExports: { countEnabledMarkets: async () => enabledMarketCount },
});
mock.module("../../../app/services/sync-market-web-push-scripts.server", {
  namedExports: { reconcileMarketWebPushScripts: async () => ({ changed: false, added: [] }) },
});

mock.method(console, "log", () => {});
mock.method(console, "error", () => {});

const { action } = await import("../../../app/routes/webhooks.app.markets");

const send = () =>
  action({
    request: new Request("https://app.example/webhooks/app/markets", { method: "POST" }),
  } as Parameters<typeof action>[0]);

beforeEach(() => {
  topic = "MARKETS_UPDATE";
  enabledMarketCount = 2;
  enqueueImpl = async () => 1;
  updateShop.mock.resetCalls();
  enqueueMarketSyncTaskForShopUrl.mock.resetCalls();
});

test("an updated market is queued and answered with 200", async () => {
  assert.equal((await send()).status, 200);
  assert.deepEqual(enqueueMarketSyncTaskForShopUrl.mock.calls[0].arguments, [
    SHOP,
    { marketId: "gid://shopify/Market/1" },
  ]);
});

test("the last market removed: cleanup is queued, then market sync is turned off", async () => {
  topic = "MARKETS_DELETE";
  enabledMarketCount = 0;

  assert.equal((await send()).status, 200);
  assert.equal(enqueueMarketSyncTaskForShopUrl.mock.callCount(), 1);
  assert.deepEqual(updateShop.mock.calls[0].arguments, [SHOP, { isMarketSyncEnabled: false }]);
});

for (const [label, impl] of [
  ["the queue is down", async () => Promise.reject(new Error("redis down"))],
  ["the job was not queued (no API key any more)", async () => 0],
] as [string, typeof enqueueImpl][]) {
  test(`the last market removed, ${label}: 500 and market sync stays on`, async () => {
    topic = "MARKETS_DELETE";
    enabledMarketCount = 0;
    enqueueImpl = impl;

    assert.equal((await send()).status, 500);
    assert.equal(updateShop.mock.callCount(), 0);
  });
}
