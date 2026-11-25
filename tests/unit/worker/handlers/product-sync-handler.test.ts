import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const SHOPIFY_UPDATED_AT = "2026-01-02T00:00:00Z";
const product = {
  id: "gid://shopify/Product/10",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: SHOPIFY_UPDATED_AT,
};
const variant = {
  id: "gid://shopify/ProductVariant/1",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: SHOPIFY_UPDATED_AT,
};

let syncRows: unknown[] = [];
const createOrUpdateProductVariantSync = mock.fn(async (_data: unknown) => ({}));
let updateProductVariants = mock.fn(
  async (_args: unknown): Promise<unknown> => ({}),
);
let defaultLanguageCode: string | null = "en";
let shopLocales: { locale: string; primary: boolean; published: boolean }[] = [];
let localesFail = false;
// `shop.primaryLocale` does not exist in the Admin API: anything but
// `shopLocales` answers with errors, as Shopify does.
const request = async (query: string) =>
  query.includes("shopLocales") && !localesFail
    ? { data: { shopLocales } }
    : { errors: { message: "Shopify failed" } };
const updateShop = mock.fn<(shop: string, data: unknown) => Promise<unknown>>(
  async () => ({}),
);
const getProductTranslations = mock.fn<
  (args: { locales: string[] }) => Promise<unknown>
>(async () => ({ product: {}, variants: {} }));
let trackedVariantIds: string[] = [];
let acceptedDeleteIds: string[] = [];
const deleteVariantSyncs = mock.fn(async (_shopId: number, _ids: string[]) => {});
const deleteMarketSyncs = mock.fn(async (_shopId: number, _ids: string[]) => {});
const writeSyncLog = mock.fn(async (_data: { status: string }) => ({}));
const sendLogEvent = mock.fn(async (_event: { logLevel: string }) => {});
let fetchShopMarketsConfig = async (): Promise<unknown> => ({ countries: [] });
let getProducts = async (): Promise<unknown> => ({
  products: [product],
  cursor: null,
  shopCurrency: "USD",
});

mock.module("../../../../app/repositories/repositories.server", {
  namedExports: {
    shopRepository: {
      getShop: async () => ({
        domain: "demo.com",
        defaultLanguageCode,
        isProductVariantSyncEnabled: true,
      }),
      updateShop,
    },
    marketSyncRepository: { deleteByVariantIds: deleteMarketSyncs },
    productVariantSyncRepository: {
      getProductVariantSyncByVariantIds: async () => syncRows,
      createOrUpdateProductVariantSync,
      getVariantIdsByShop: async () => trackedVariantIds,
      deleteByVariantIds: deleteVariantSyncs,
    },
    productVariantSyncLogRepository: {
      createOrUpdateProductVariantSyncLog: writeSyncLog,
    },
  },
});
mock.module("../../../../app/api/update-product-variants", {
  namedExports: {
    updateProductVariants: (args: unknown) => updateProductVariants(args),
  },
});
mock.module("../../../../app/api/delete-product-variants", {
  namedExports: { deleteProductVariants: async () => acceptedDeleteIds },
});
mock.module("../../../../app/worker/services/create-client", {
  namedExports: { createClient: () => ({ request }) },
});
mock.module("../../../../app/worker/services/get-products", {
  namedExports: {
    getProducts: () => getProducts(),
  },
});
mock.module("../../../../app/worker/services/get-product-variants-count", {
  namedExports: { getProductVariantsCount: async () => 1 },
});
mock.module("../../../../app/worker/services/get-product-variants", {
  namedExports: { fetchAllProductVariants: async () => [variant] },
});
mock.module("../../../../app/worker/services/create-product-variant-payload", {
  namedExports: {
    createProductVariantPayload: (_p: unknown, v: { id: string }) => ({
      productId: v.id.split("/").pop(),
    }),
  },
});
mock.module("../../../../app/worker/services/fetch-shop-markets-config", {
  namedExports: {
    fetchShopMarketsConfig: () => fetchShopMarketsConfig(),
  },
});
mock.module("../../../../app/worker/services/get-product-market-publication", {
  namedExports: { getPublishedInAnyMarket: async () => new Map() },
});
mock.module("../../../../app/worker/services/get-product-translations", {
  namedExports: { getProductTranslations },
});
mock.module("../../../../app/api/send-log-event", {
  namedExports: { sendLogEvent },
});
mock.module("../../../../app/services/refresh-product-variant-sync-log.server", {
  namedExports: { markProductVariantSyncResults: async () => {} },
});

const { productSyncHandler } = await import(
  "../../../../app/worker/handlers/product-sync-handler"
);

const run = () =>
  productSyncHandler("demo.myshopify.com", "token", "key", 1, null, "site");

beforeEach(() => {
  syncRows = [];
  defaultLanguageCode = "en";
  shopLocales = [{ locale: "en", primary: true, published: true }];
  localesFail = false;
  updateShop.mock.resetCalls();
  getProductTranslations.mock.resetCalls();
  trackedVariantIds = [];
  acceptedDeleteIds = [];
  createOrUpdateProductVariantSync.mock.resetCalls();
  deleteVariantSyncs.mock.resetCalls();
  deleteMarketSyncs.mock.resetCalls();
  writeSyncLog.mock.resetCalls();
  sendLogEvent.mock.resetCalls();
  fetchShopMarketsConfig = async () => ({ countries: [] });
  getProducts = async () => ({
    products: [product],
    cursor: null,
    shopCurrency: "USD",
  });
  updateProductVariants = mock.fn(async () => ({}));
});

test("failed row is resent even when it is newer than Shopify", async () => {
  syncRows = [
    {
      variantId: variant.id,
      syncFailed: true,
      syncedTagKeys: [],
      updatedAt: new Date(SHOPIFY_UPDATED_AT),
    },
  ];

  await run();

  assert.equal(updateProductVariants.mock.callCount(), 1);
  const args = updateProductVariants.mock.calls[0].arguments[0] as {
    productVariants: { productId: string }[];
  };
  assert.deepEqual(
    args.productVariants.map((item) => item.productId),
    ["1"],
  );
});

test("row stays failed when Yespo request throws", async () => {
  updateProductVariants = mock.fn(async () => {
    throw new Error("502");
  });

  await run();

  assert.equal(updateProductVariants.mock.callCount(), 1);
  assert.equal(createOrUpdateProductVariantSync.mock.callCount(), 1);
  const data = createOrUpdateProductVariantSync.mock.calls[0].arguments[0] as {
    syncFailed?: boolean;
  };
  assert.equal(data.syncFailed, true);
});

test("keeps local rows of orphaned variants Yespo did not delete", async () => {
  trackedVariantIds = [
    variant.id,
    "gid://shopify/ProductVariant/2",
    "gid://shopify/ProductVariant/3",
  ];
  acceptedDeleteIds = ["3"];

  await run();

  for (const deleteRows of [deleteVariantSyncs, deleteMarketSyncs]) {
    assert.equal(deleteRows.mock.callCount(), 1);
    assert.deepEqual(deleteRows.mock.calls[0].arguments[1], [
      "gid://shopify/ProductVariant/3",
    ]);
  }
});

test("a failed markets config read ends the sync with ERROR and a log event", async () => {
  trackedVariantIds = [variant.id, "gid://shopify/ProductVariant/2"];
  acceptedDeleteIds = ["2"];
  fetchShopMarketsConfig = async () => {
    throw new Error("Failed to fetch countries of market");
  };

  // The handler's own catch handles it: nothing is thrown to the worker.
  await run();

  assert.deepEqual(
    writeSyncLog.mock.calls.map((call) => call.arguments[0].status),
    ["ERROR"],
  );
  assert.deepEqual(
    sendLogEvent.mock.calls.map((call) => call.arguments[0].logLevel),
    ["ERROR"],
  );
  assert.equal(updateProductVariants.mock.callCount(), 0);
  assert.equal(deleteVariantSyncs.mock.callCount(), 0);
  assert.equal(deleteMarketSyncs.mock.callCount(), 0);
});

test("a failed products page ends the sync with ERROR and deletes nothing", async () => {
  trackedVariantIds = [variant.id, "gid://shopify/ProductVariant/2"];
  acceptedDeleteIds = ["2"];
  let page = 0;
  getProducts = async () => {
    page += 1;
    if (page === 1) {
      return { products: [product], cursor: "p1", shopCurrency: "USD" };
    }
    throw new Error("Failed to fetch products");
  };

  await run();

  assert.deepEqual(
    writeSyncLog.mock.calls.map((call) => call.arguments[0].status),
    ["IN_PROGRESS", "ERROR"],
  );
  assert.deepEqual(
    sendLogEvent.mock.calls.map((call) => call.arguments[0].logLevel),
    ["ERROR"],
  );
  assert.equal(deleteVariantSyncs.mock.callCount(), 0);
  assert.equal(deleteMarketSyncs.mock.callCount(), 0);
});

const sentLanguageCode = () =>
  (updateProductVariants.mock.calls[0].arguments[0] as { languageCode: string })
    .languageCode;
const translatedLocales = () =>
  getProductTranslations.mock.calls[0]?.arguments[0].locales ?? [];
const ukrainianShop = [
  { locale: "uk", primary: true, published: true },
  { locale: "en", primary: false, published: true },
  { locale: "pl", primary: false, published: true },
];

test("a new shop sends its primary locale and stores it", async () => {
  defaultLanguageCode = null;
  shopLocales = ukrainianShop;

  await run();

  assert.equal(sentLanguageCode(), "uk");
  assert.deepEqual(translatedLocales(), ["en", "pl"]);
  assert.deepEqual(
    updateShop.mock.calls.map((call) => call.arguments),
    [
      [
        "demo.myshopify.com",
        { defaultLanguageCode: "uk", defaultCurrency: "USD" },
      ],
    ],
  );
});

test("the language is not stored when the request to Yespo throws", async () => {
  defaultLanguageCode = null;
  shopLocales = ukrainianShop;
  updateProductVariants = mock.fn(async () => {
    throw new Error("409");
  });

  await run();

  assert.equal(updateProductVariants.mock.callCount(), 1);
  assert.equal(updateShop.mock.callCount(), 0);
});

test("a shop with a stored language keeps it", async () => {
  shopLocales = ukrainianShop;

  await run();

  assert.equal(sentLanguageCode(), "en");
  assert.deepEqual(translatedLocales(), ["pl"]);
  assert.equal(updateShop.mock.callCount(), 0);
});

test("failed shop locales: a new shop syncs in English without translations", async () => {
  defaultLanguageCode = null;
  localesFail = true;

  await run();

  assert.equal(sentLanguageCode(), "en");
  assert.equal(getProductTranslations.mock.callCount(), 0);
  assert.equal(updateShop.mock.callCount(), 1);
  assert.equal(writeSyncLog.mock.calls.at(-1)?.arguments[0].status, "COMPLETE");
});
