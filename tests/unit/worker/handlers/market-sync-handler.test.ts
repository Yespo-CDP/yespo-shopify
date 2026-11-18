import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

interface StagedRow {
  id: number;
  productId: string;
  variantId: string;
  countryCode: string;
  payload: Record<string, unknown>;
}

interface SyncedRow {
  id: number;
  productId: string;
  variantId: string;
  countryCode: string;
}

interface MarketsCall {
  markets: {
    marketId: string;
    products: { productId: string; isInStock?: number; price?: number }[];
  }[];
}

const variantGid = (n: number) => `gid://shopify/ProductVariant/${n}`;

/** A staged row; without `priced` it has no market price, like the parser's. */
const staged = (id: number, variant: number, countryCode: string, priced = true): StagedRow => ({
  id,
  productId: `gid://shopify/Product/${variant}`,
  variantId: variantGid(variant),
  countryCode,
  payload: priced
    ? {
        type: "pricing",
        variantUpdatedAt: "2026-11-01T00:00:00Z",
        inventoryQuantity: 5,
        pricing: { price: { amount: "10.00", currencyCode: "EUR" } },
        marketUrls: { urlsTranslations: [], clearUrls: true },
      }
    : { type: "pricing" },
});

const synced = (id: number, variant: number, countryCode: string): SyncedRow => ({
  id,
  productId: `gid://shopify/Product/${variant}`,
  variantId: variantGid(variant),
  countryCode,
});

const range = (from: number, to: number, countryCode: string) =>
  Array.from({ length: to - from + 1 }, (_, index) => staged(from + index, from + index, countryCode));

let countries: string[] = [];
let pages: StagedRow[][] = [];
let syncedRows: SyncedRow[] = [];
let bulkUrl: string | null = null;
let bulkCount = 0;
let streamImpl = async () => "/tmp/bulk.jsonl";
let updateImpl = async (_args: MarketsCall, _call: number) => ({ failedItems: [] as string[] });
let deleteByBatchImpl = async () => {};

const writeLog = mock.fn(async (_data: { countryCode: string; status: string }) => ({}));
const sendLogEvent = mock.fn(async (_event: { data: unknown; message: string }) => {});
const updateMarketProducts = mock.fn(async (args: MarketsCall) =>
  updateImpl(args, updateMarketProducts.mock.callCount()),
);
const streamBulkJsonlToTmpMarketSync = mock.fn(async () => streamImpl());
const getPage = mock.fn(
  async (_shopId: number, _batchId: string, afterId: number, _take: number) =>
    pages.find((page) => page[0].id > afterId) ?? [],
);
const deleteByBatch = mock.fn(async (_shopId: number, _batchId: string) => deleteByBatchImpl());
const consoleError = mock.method(console, "error", () => {});
mock.method(console, "log", () => {});
mock.method(console, "warn", () => {});

mock.module("../../../../app/repositories/repositories.server", {
  namedExports: {
    shopRepository: {
      getShop: async () => ({ domain: "demo.com", isMarketSyncEnabled: true }),
    },
    marketSyncLogRepository: { createOrUpdate: writeLog },
    marketSyncRepository: {
      getSyncedCountryCodes: async () => countries,
      getByCountryPage: async (_shopId: number, countryCode: string, afterId: number) =>
        syncedRows.filter((row) => row.countryCode === countryCode && row.id > afterId),
      getByKeys: async () => [],
      deleteManyByKeys: async () => {},
      createOrUpdate: async () => ({}),
    },
    shopMarketRepository: {
      getByShopId: async () => [],
      replaceAll: async () => {},
    },
    tmpMarketSyncRepository: { getPage, deleteByBatch },
  },
});
mock.module("../../../../app/api/update-market-products", {
  namedExports: { updateMarketProducts },
});
mock.module("../../../../app/api/send-log-event", {
  namedExports: { sendLogEvent },
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
          name: "Europe",
          handle: "eu",
          enabled: true,
          countries,
          locales: ["de"],
          rootUrls: {},
          catalogPublicationIds: [],
        },
      ],
      countries,
      locales: ["de"],
    }),
  },
});
mock.module("../../../../app/worker/services/bulk-operation.server", {
  namedExports: {
    runBulkQuery: async () => `gid://shopify/BulkOperation/${++bulkCount}`,
    waitForBulkOperation: async () =>
      bulkUrl ? { url: bulkUrl, objectCount: 1 } : { url: null, objectCount: 0 },
  },
});
mock.module("../../../../app/worker/services/parse-bulk-jsonl", {
  namedExports: { streamBulkJsonlToTmpMarketSync },
});

const { marketSyncHandler } = await import(
  "../../../../app/worker/handlers/market-sync-handler"
);

const runSync = () => marketSyncHandler("demo.myshopify.com", "token", "key", 1, null, "site");

const sentCalls = () =>
  updateMarketProducts.mock.calls.map((call) => call.arguments[0].markets[0]);

const pricedCalls = () => sentCalls().filter((market) => market.products[0]?.isInStock !== 0);

const outOfStockCalls = () =>
  sentCalls()
    .filter((market) => market.products.every((product) => product.isInStock === 0))
    .map(({ marketId, products }) => ({ marketId, ids: products.map((p) => p.productId) }));

const countryLogs = () =>
  sendLogEvent.mock.calls
    .map((call) => JSON.parse(call.arguments[0].data as string))
    .filter((data) => data.countryCode);

const lastStatus = (countryCode: string) =>
  writeLog.mock.calls
    .map((call) => call.arguments[0])
    .filter((log) => log.countryCode === countryCode)
    .at(-1)?.status;

beforeEach(() => {
  countries = ["DE"];
  pages = [];
  syncedRows = [];
  bulkUrl = "https://bulk.example/result.jsonl";
  bulkCount = 0;
  streamImpl = async () => "/tmp/bulk.jsonl";
  updateImpl = async () => ({ failedItems: [] });
  deleteByBatchImpl = async () => {};
  writeLog.mock.resetCalls();
  sendLogEvent.mock.resetCalls();
  updateMarketProducts.mock.resetCalls();
  streamBulkJsonlToTmpMarketSync.mock.resetCalls();
  getPage.mock.resetCalls();
  deleteByBatch.mock.resetCalls();
  consoleError.mock.resetCalls();
});

test("empty bulk result completes the market and clears its synced variants", async () => {
  bulkUrl = null;
  syncedRows = [synced(1, 1, "DE")];

  await runSync();

  assert.equal(streamBulkJsonlToTmpMarketSync.mock.callCount(), 0);
  assert.equal(updateMarketProducts.mock.callCount(), 1);
  assert.deepEqual(outOfStockCalls(), [{ marketId: "DE", ids: ["1"] }]);

  const statuses = writeLog.mock.calls.map((call) => call.arguments[0].status);
  assert.equal(statuses.at(-1), "COMPLETE");
  assert.ok(!statuses.includes("ERROR"));
});

test("reads staged rows page by page after the last id and sends rows of every page", async () => {
  pages = [[staged(1, 1, "DE"), staged(2, 2, "DE")], [staged(5, 3, "DE")]];

  await runSync();

  assert.deepEqual(
    getPage.mock.calls.map((call) => call.arguments),
    [
      [1, "gid://shopify/BulkOperation/1", 0, 1000],
      [1, "gid://shopify/BulkOperation/1", 2, 1000],
      [1, "gid://shopify/BulkOperation/1", 5, 1000],
    ],
  );
  assert.deepEqual(
    pricedCalls().map(({ marketId, products }) => ({ marketId, ids: products.map((p) => p.productId) })),
    [{ marketId: "DE", ids: ["1", "2", "3"] }],
  );
  assert.equal(lastStatus("DE"), "COMPLETE");
});

test("a variant split between pages is sent and kept present in both countries", async () => {
  countries = ["DE", "PL"];
  pages = [[staged(1, 1, "DE")], [staged(2, 1, "PL")]];
  syncedRows = [synced(1, 1, "DE"), synced(2, 1, "PL")];

  await runSync();

  assert.deepEqual(
    pricedCalls().map(({ marketId, products }) => ({ marketId, ids: products.map((p) => p.productId) })),
    [
      { marketId: "DE", ids: ["1"] },
      { marketId: "PL", ids: ["1"] },
    ],
  );
  assert.deepEqual(outOfStockCalls(), []);
});

test("catalog cleanup sees variants staged on every page", async () => {
  // Variant 1 is staged only on the first page, without a price.
  pages = [[staged(1, 1, "DE", false)], [staged(2, 2, "DE")]];
  syncedRows = [synced(1, 1, "DE"), synced(2, 3, "DE")];

  await runSync();

  assert.deepEqual(outOfStockCalls(), [{ marketId: "DE", ids: ["3"] }]);
});

test("items are buffered across pages and sent in chunks of 500", async () => {
  pages = [range(1, 300, "DE"), range(301, 600, "DE")];

  await runSync();

  assert.deepEqual(
    pricedCalls().map((market) => market.products.length),
    [500, 100],
  );
});

test("each country is logged once with results summed over all its requests", async () => {
  pages = [range(1, 300, "DE"), range(301, 600, "DE")];
  updateImpl = async (_args, call) => ({ failedItems: call === 0 ? ["5"] : ["550"] });

  await runSync();

  assert.deepEqual(countryLogs(), [
    {
      domain: "demo.com",
      countryCode: "DE",
      synced: 598,
      failedCount: 2,
      failedItems: ["5", "550"],
    },
  ]);
});

test("a country without staged rows gets no country log but its synced variants are cleared", async () => {
  countries = ["DE", "PL"];
  pages = [[staged(1, 1, "DE")]];
  syncedRows = [synced(1, 9, "PL")];

  await runSync();

  assert.deepEqual(
    countryLogs().map((data) => data.countryCode),
    ["DE"],
  );
  assert.deepEqual(outOfStockCalls(), [{ marketId: "PL", ids: ["9"] }]);
  assert.equal(lastStatus("DE"), "COMPLETE");
  assert.equal(lastStatus("PL"), "COMPLETE");
});

test("an error while sending the second page still deletes the staged batch", async () => {
  pages = [range(1, 500, "DE"), range(501, 1000, "DE"), range(1001, 1001, "DE")];
  syncedRows = [synced(1, 2000, "DE")];
  updateImpl = async (_args, call) => {
    if (call === 1) throw new Error("Yespo is down");
    return { failedItems: [] };
  };

  await runSync();

  assert.deepEqual(
    getPage.mock.calls.map((call) => call.arguments[2]),
    [0, 500],
  );
  assert.deepEqual(
    deleteByBatch.mock.calls.map((call) => call.arguments),
    [[1, "gid://shopify/BulkOperation/1"]],
  );
  assert.deepEqual(outOfStockCalls(), []);
  assert.equal(lastStatus("DE"), "ERROR");
});

test("an error while staging the bulk result deletes the partly staged batch", async () => {
  streamImpl = async () => {
    throw new Error("download failed");
  };

  await runSync();

  assert.equal(getPage.mock.callCount(), 0);
  assert.deepEqual(
    deleteByBatch.mock.calls.map((call) => call.arguments),
    [[1, "gid://shopify/BulkOperation/1"]],
  );
  assert.equal(lastStatus("DE"), "ERROR");
});

test("every bulk batch deletes its own staged rows", async () => {
  countries = Array.from({ length: 16 }, (_, index) => `C${index}`);

  await runSync();

  assert.deepEqual(
    deleteByBatch.mock.calls.map((call) => call.arguments),
    [
      [1, "gid://shopify/BulkOperation/1"],
      [1, "gid://shopify/BulkOperation/2"],
    ],
  );
  assert.ok(countries.every((countryCode) => lastStatus(countryCode) === "COMPLETE"));
});

test("a failed staging cleanup is logged and does not fail a successful sync", async () => {
  pages = [[staged(1, 1, "DE")]];
  deleteByBatchImpl = async () => {
    throw new Error("db unavailable");
  };

  await runSync();

  assert.equal(lastStatus("DE"), "COMPLETE");
  assert.ok(
    consoleError.mock.calls.some((call) =>
      String(call.arguments[0]).includes("failed to delete staging rows"),
    ),
  );
  assert.ok(
    !consoleError.mock.calls.some((call) => call.arguments[0] === "Market sync error"),
  );
});
