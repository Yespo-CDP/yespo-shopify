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
let trackedVariantIds: string[] = [];
let acceptedDeleteIds: string[] = [];
const deleteVariantSyncs = mock.fn(async (_shopId: number, _ids: string[]) => {});
const deleteMarketSyncs = mock.fn(async (_shopId: number, _ids: string[]) => {});
const writeSyncLog = mock.fn(async (_data: { status: string }) => ({}));
const sendLogEvent = mock.fn(async (_event: { logLevel: string }) => {});
let fetchShopMarketsConfig = async (): Promise<unknown> => ({ countries: [] });

mock.module("../../../../app/repositories/repositories.server", {
  namedExports: {
    shopRepository: {
      getShop: async () => ({
        domain: "demo.com",
        defaultLanguageCode: "en",
        isProductVariantSyncEnabled: true,
      }),
      updateShop: async () => ({}),
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
  namedExports: { createClient: () => ({}) },
});
mock.module("../../../../app/worker/services/get-products", {
  namedExports: {
    getProducts: async () => ({
      products: [product],
      cursor: null,
      shopCurrency: "USD",
    }),
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
mock.module("../../../../app/worker/services/get-shop-primary-locale", {
  namedExports: { getShopPrimaryLocale: async () => "en" },
});
mock.module("../../../../app/worker/services/get-shop-locales", {
  namedExports: { getShopSecondaryLocales: async () => [] },
});
mock.module("../../../../app/worker/services/get-product-translations", {
  namedExports: { getProductTranslations: async () => ({ product: {}, variants: {} }) },
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
  trackedVariantIds = [];
  acceptedDeleteIds = [];
  createOrUpdateProductVariantSync.mock.resetCalls();
  deleteVariantSyncs.mock.resetCalls();
  deleteMarketSyncs.mock.resetCalls();
  writeSyncLog.mock.resetCalls();
  sendLogEvent.mock.resetCalls();
  fetchShopMarketsConfig = async () => ({ countries: [] });
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
