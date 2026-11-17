import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

type Row = {
  productId: string;
  variantId: string;
  countryCode: string;
  contentHash: string | null;
};
type Key = Pick<Row, "productId" | "variantId" | "countryCode">;

const PRODUCT_GID = "gid://shopify/Product/10";
const LEGACY_ID = "10";
const VARIANT_1 = "gid://shopify/ProductVariant/1";

const state = {
  rows: [] as Row[],
  countries: ["US"],
  published: { US: true } as Record<string, boolean>,
  variants: ["1", "2"],
  failedItems: [] as string[],
};

const sameKey = (row: Key, key: Key) =>
  row.productId === key.productId &&
  row.variantId === key.variantId &&
  row.countryCode === key.countryCode;

const getByKeys = mock.fn(async (_shopId: number, keys: Key[]) =>
  state.rows.filter((row) => keys.some((key) => sameKey(row, key))),
);
const createOrUpdate = mock.fn(async (data: Row) => {
  const row = state.rows.find((r) => sameKey(r, data));
  if (row) row.contentHash = data.contentHash;
  else state.rows.push({ ...data });
  return {};
});
const deleteManyByKeys = mock.fn(async (_shopId: number, keys: Key[]) => {
  state.rows = state.rows.filter((row) => !keys.some((key) => sameKey(row, key)));
});
const updateMarketProducts = mock.fn(
  async (_args: {
    markets: Array<{
      marketId: string;
      products: Array<{ productId: string; isInStock?: 0 | 1 }>;
    }>;
  }) => ({ id: 1, failedItems: state.failedItems }),
);

const variant = (id: string) => ({
  variantId: `gid://shopify/ProductVariant/${id}`,
  updatedAt: "2026-01-01T00:00:00Z",
  inventoryQuantity: 1,
  perCountry: { US: { price: { amount: "10", currencyCode: "USD" } } },
});

mock.module("../../../app/repositories/repositories.server", {
  namedExports: {
    marketSyncRepository: {
      getSyncedCountryCodes: async () => [
        ...new Set(state.rows.map((row) => row.countryCode)),
      ],
      getByKeys,
      createOrUpdate,
      deleteManyByKeys,
    },
    shopMarketRepository: { getByShopId: async () => [] },
  },
});
mock.module("../../../app/api/update-market-products", {
  namedExports: { updateMarketProducts },
});
mock.module("../../../app/worker/services/create-client", {
  namedExports: { createClient: () => ({}) },
});
mock.module("../../../app/worker/services/fetch-shop-markets-config", {
  namedExports: {
    fetchShopMarketsConfig: async () => ({
      countries: state.countries,
      markets: [],
    }),
  },
});
mock.module("../../../app/worker/services/get-product-contextual-pricing", {
  namedExports: {
    getProductContextualPricing: async () => ({
      handle: "shirt",
      publishedInCountry: state.published,
      variants: state.variants.map(variant),
    }),
  },
});

const { updateMarketFromWebhook } = await import(
  "../../../app/services/update-market-from-webhook.server"
);

const runWebhook = () =>
  updateMarketFromWebhook({
    shopId: 1,
    shopifyDomain: "demo.myshopify.com",
    accessToken: "token",
    productGid: PRODUCT_GID,
    isMarketSyncEnabled: true,
    apiKey: "key",
    siteId: "site",
    domain: "demo.com",
  });

const sentProducts = () =>
  updateMarketProducts.mock.calls.flatMap((call) =>
    call.arguments[0].markets.flatMap((market) =>
      market.products.map((product) => ({
        marketId: market.marketId,
        ...product,
      })),
    ),
  );

const rowsOf = (productId: string) =>
  state.rows.filter((row) => row.productId === productId);

/** Hash the webhook stores for variant 1 at the current price. */
async function currentHash(): Promise<string> {
  await runWebhook();
  const hash = state.rows[0].contentHash as string;
  state.rows = [];
  return hash;
}

beforeEach(() => {
  state.rows = [];
  state.countries = ["US"];
  state.published = { US: true };
  state.variants = ["1"];
  state.failedItems = [];
  for (const fn of [getByKeys, createOrUpdate, deleteManyByKeys, updateMarketProducts]) {
    fn.mock.resetCalls();
  }
});

test("does not store the hash of a variant Yespo rejected", async () => {
  state.variants = ["1", "2"];
  state.failedItems = ["2"];

  await runWebhook();

  assert.deepEqual(
    createOrUpdate.mock.calls.map((call) => call.arguments[0].variantId),
    [VARIANT_1],
  );
});

test("looks rows up by the product GID and by the old numeric id", async () => {
  await runWebhook();

  assert.deepEqual(getByKeys.mock.calls[0].arguments[1], [
    { productId: PRODUCT_GID, variantId: VARIANT_1, countryCode: "US" },
    { productId: LEGACY_ID, variantId: VARIANT_1, countryCode: "US" },
  ]);
  assert.equal(createOrUpdate.mock.calls[0].arguments[0].productId, PRODUCT_GID);
});

test("skips a variant whose GID row already has the same hash", async () => {
  const hash = await currentHash();
  updateMarketProducts.mock.resetCalls();
  createOrUpdate.mock.resetCalls();
  state.rows = [
    { productId: PRODUCT_GID, variantId: VARIANT_1, countryCode: "US", contentHash: hash },
  ];

  await runWebhook();

  assert.equal(updateMarketProducts.mock.callCount(), 0);
  assert.equal(createOrUpdate.mock.callCount(), 0);
});

test("replaces a numeric row: sends the data, writes the GID row, drops the numeric one", async () => {
  const hash = await currentHash();
  updateMarketProducts.mock.resetCalls();
  state.rows = [
    { productId: LEGACY_ID, variantId: VARIANT_1, countryCode: "US", contentHash: hash },
  ];

  await runWebhook();

  assert.deepEqual(
    sentProducts().map((p) => p.productId),
    ["1"],
  );
  assert.deepEqual(rowsOf(LEGACY_ID), []);
  assert.deepEqual(rowsOf(PRODUCT_GID).map((row) => row.contentHash), [hash]);
});

test("does not trust a GID hash when a numeric row exists next to it", async () => {
  const hash = await currentHash();
  updateMarketProducts.mock.resetCalls();
  // Bulk wrote the current price, then an older webhook sent another one.
  state.rows = [
    { productId: PRODUCT_GID, variantId: VARIANT_1, countryCode: "US", contentHash: hash },
    { productId: LEGACY_ID, variantId: VARIANT_1, countryCode: "US", contentHash: "newer" },
  ];

  await runWebhook();

  assert.equal(sentProducts().length, 1);
  assert.deepEqual(rowsOf(LEGACY_ID), []);
  assert.deepEqual(rowsOf(PRODUCT_GID).map((row) => row.contentHash), [hash]);
});

test("keeps the numeric row and stores no hash when Yespo rejects the variant", async () => {
  state.failedItems = ["1"];
  state.rows = [
    { productId: LEGACY_ID, variantId: VARIANT_1, countryCode: "US", contentHash: "old" },
  ];

  await runWebhook();

  assert.equal(createOrUpdate.mock.callCount(), 0);
  assert.deepEqual(state.rows, [
    { productId: LEGACY_ID, variantId: VARIANT_1, countryCode: "US", contentHash: "old" },
  ]);
});

test("unpublished from a market: sends isInStock 0 once and drops both rows", async () => {
  state.published = { US: false };
  state.rows = [
    { productId: PRODUCT_GID, variantId: VARIANT_1, countryCode: "US", contentHash: "a" },
    { productId: LEGACY_ID, variantId: VARIANT_1, countryCode: "US", contentHash: "b" },
  ];

  await runWebhook();

  assert.deepEqual(
    sentProducts().map(({ marketId, productId, isInStock }) => ({ marketId, productId, isInStock })),
    [{ marketId: "US", productId: "1", isInStock: 0 }],
  );
  assert.deepEqual(state.rows, []);
});

test("unpublished from a market with only a numeric row: sends isInStock 0 and drops it", async () => {
  state.published = { US: false };
  state.rows = [
    { productId: LEGACY_ID, variantId: VARIANT_1, countryCode: "US", contentHash: "a" },
  ];

  await runWebhook();

  assert.deepEqual(
    sentProducts().map((p) => [p.marketId, p.productId, p.isInStock]),
    [["US", "1", 0]],
  );
  assert.deepEqual(state.rows, []);
});

test("removed market: sends isInStock 0 once for GID and numeric rows and drops them", async () => {
  const hash = await currentHash();
  updateMarketProducts.mock.resetCalls();
  state.rows = [
    { productId: PRODUCT_GID, variantId: VARIANT_1, countryCode: "US", contentHash: hash },
    { productId: PRODUCT_GID, variantId: VARIANT_1, countryCode: "DE", contentHash: "a" },
    { productId: LEGACY_ID, variantId: VARIANT_1, countryCode: "DE", contentHash: "b" },
  ];

  await runWebhook();

  assert.deepEqual(
    sentProducts().map((p) => [p.marketId, p.productId, p.isInStock]),
    [["DE", "1", 0]],
  );
  assert.deepEqual(state.rows.map((row) => row.countryCode), ["US"]);
});
