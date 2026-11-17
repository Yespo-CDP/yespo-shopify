import assert from "node:assert/strict";
import { mock, test } from "node:test";

const syncedRow = {
  id: 1,
  productId: "gid://shopify/Product/10",
  variantId: "gid://shopify/ProductVariant/1",
  countryCode: "DE",
};

const writeLog = mock.fn(async (_data: { countryCode: string; status: string }) => ({}));
const updateMarketProducts = mock.fn(async (_args: unknown) => ({
  failedItems: [] as string[],
}));
const streamBulkJsonlToTmpMarketSync = mock.fn(async () => "/tmp/bulk.jsonl");

mock.module("../../../../app/repositories/repositories.server", {
  namedExports: {
    shopRepository: {
      getShop: async () => ({ domain: "demo.com", isMarketSyncEnabled: true }),
    },
    marketSyncLogRepository: { createOrUpdate: writeLog },
    marketSyncRepository: {
      getSyncedCountryCodes: async () => ["DE"],
      getByCountryPage: async (_shopId: number, _country: string, afterId: number) =>
        afterId === 0 ? [syncedRow] : [],
      getByKeys: async () => [],
      deleteManyByKeys: async () => {},
    },
    shopMarketRepository: {
      getByShopId: async () => [],
      replaceAll: async () => {},
    },
    tmpMarketSyncRepository: {
      getByBatch: async () => [],
      deleteByBatch: async () => {},
    },
  },
});
mock.module("../../../../app/api/update-market-products", {
  namedExports: { updateMarketProducts },
});
mock.module("../../../../app/api/send-log-event", {
  namedExports: { sendLogEvent: async () => {} },
});
mock.module("../../../../app/worker/services/create-client", {
  namedExports: { createClient: () => ({}) },
});
mock.module("../../../../app/worker/services/fetch-shop-markets-config", {
  namedExports: {
    fetchShopMarketsConfig: async () => ({
      markets: [
        {
          id: "gid://shopify/Market/1",
          name: "Germany",
          handle: "de",
          enabled: true,
          countries: ["DE"],
          locales: ["de"],
          rootUrls: {},
          catalogPublicationIds: [],
        },
      ],
      countries: ["DE"],
      locales: ["de"],
    }),
  },
});
mock.module("../../../../app/worker/services/bulk-operation.server", {
  namedExports: {
    runBulkQuery: async () => "gid://shopify/BulkOperation/1",
    waitForBulkOperation: async () => ({ url: null, objectCount: 0 }),
  },
});
mock.module("../../../../app/worker/services/parse-bulk-jsonl", {
  namedExports: { streamBulkJsonlToTmpMarketSync },
});

const { marketSyncHandler } = await import(
  "../../../../app/worker/handlers/market-sync-handler"
);

test("empty bulk result completes the market and clears its synced variants", async () => {
  await marketSyncHandler("demo.myshopify.com", "token", "key", 1, null, "site");

  assert.equal(streamBulkJsonlToTmpMarketSync.mock.callCount(), 0);

  assert.equal(updateMarketProducts.mock.callCount(), 1);
  const { markets } = updateMarketProducts.mock.calls[0].arguments[0] as {
    markets: { marketId: string; products: { productId: string; isInStock: number }[] }[];
  };
  assert.deepEqual(
    markets.map(({ marketId, products }) => ({
      marketId,
      products: products.map(({ productId, isInStock }) => ({ productId, isInStock })),
    })),
    [{ marketId: "DE", products: [{ productId: "1", isInStock: 0 }] }],
  );

  const statuses = writeLog.mock.calls.map((call) => call.arguments[0].status);
  assert.equal(statuses.at(-1), "COMPLETE");
  assert.ok(!statuses.includes("ERROR"));
});
