import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const SHOP = "demo.myshopify.com";
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

const calls: string[] = [];
let defaultLanguageCode: string | null = null;
let syncRows: unknown[] = [];
let sendError: Error | null = null;

const updateShop = mock.fn<(shop: string, data: unknown) => Promise<void>>(
  async () => {
    calls.push("updateShop");
  },
);
const updateProductVariants = mock.fn<
  (args: { languageCode: string }) => Promise<unknown>
>(async () => {
  calls.push("updateProductVariants");
  if (sendError) throw sendError;
  return {};
});
const getProductTranslations = mock.fn<
  (args: { locales: string[] }) => Promise<unknown>
>(async () => ({ product: {}, variants: {} }));
// `shop.primaryLocale` does not exist in the Admin API: anything but
// `shopLocales` answers with errors, as Shopify does.
const request = async (query: string) =>
  query.includes("shopLocales")
    ? {
        data: {
          shopLocales: [
            { locale: "uk", primary: true, published: true },
            { locale: "en", primary: false, published: true },
          ],
        },
      }
    : { errors: { message: "Field doesn't exist" } };

mock.module("../../../../app/repositories/repositories.server", {
  namedExports: {
    shopRepository: {
      getShop: async () => ({
        id: 1,
        apiKey: "key",
        siteId: "site",
        domain: "demo.com",
        defaultLanguageCode,
        isProductVariantSyncEnabled: true,
      }),
      updateShop,
    },
    marketSyncRepository: {},
    productVariantSyncRepository: {
      getProductVariantSyncByVariantIds: async () => syncRows,
      createOrUpdateProductVariantSync: async () => ({}),
      getVariantIdsByProductId: async () => [variant.id],
    },
  },
});
mock.module("../../../../app/api/update-product-variants", {
  namedExports: { updateProductVariants },
});
mock.module("../../../../app/api/delete-product-variants", {
  namedExports: { deleteProductVariants: async () => [] },
});
mock.module("../../../../app/services/delete-product-variant.service", {
  namedExports: { deleteProductVariantService: async () => {} },
});
mock.module("../../../../app/services/refresh-product-variant-sync-log.server", {
  namedExports: {
    markProductVariantSyncResults: async () => {
      calls.push("markProductVariantSyncResults");
    },
    refreshProductVariantSyncLog: async () => {},
  },
});
mock.module("../../../../app/services/update-market-from-webhook.server", {
  namedExports: { updateMarketFromWebhook: async () => {} },
});
mock.module("../../../../app/worker/services/create-client", {
  namedExports: { createClient: () => ({ request }) },
});
mock.module("../../../../app/worker/services/offline-token-manager", {
  namedExports: {
    createOfflineTokenManager: () => ({ getAccessToken: async () => "token" }),
  },
});
mock.module("../../../../app/worker/services/create-product-variant-payload", {
  namedExports: {
    createProductVariantPayload: (_p: unknown, v: { id: string }) => ({
      productId: v.id.split("/").pop(),
    }),
  },
});
mock.module("../../../../app/worker/services/fetch-shop-markets-config", {
  namedExports: { fetchShopMarketsConfig: async () => ({ countries: [] }) },
});
mock.module("../../../../app/worker/services/get-product-market-publication", {
  namedExports: { getPublishedInAnyMarket: async () => new Map() },
});
mock.module("../../../../app/worker/services/get-product-variants", {
  namedExports: { fetchAllProductVariants: async () => [variant] },
});
mock.module("../../../../app/worker/services/get-products", {
  namedExports: {
    getProductById: async () => ({ product: { ...product }, shopCurrency: "UAH" }),
  },
});
mock.module("../../../../app/worker/services/get-product-translations", {
  namedExports: { getProductTranslations },
});

const { productWebhookHandler } = await import(
  "../../../../app/worker/handlers/product-webhook-handler"
);

const run = () =>
  productWebhookHandler({
    shop: SHOP,
    topic: "PRODUCTS_UPDATE",
    productGid: product.id,
  } as Parameters<typeof productWebhookHandler>[0]);

beforeEach(() => {
  calls.length = 0;
  defaultLanguageCode = null;
  syncRows = [];
  sendError = null;
  updateShop.mock.resetCalls();
  updateProductVariants.mock.resetCalls();
  getProductTranslations.mock.resetCalls();
});

for (const stored of [null, ""]) {
  test(`stored language ${JSON.stringify(stored)}: sends the shop primary locale and stores it after Yespo accepts`, async () => {
    defaultLanguageCode = stored;

    await run();

    assert.equal(updateProductVariants.mock.calls[0].arguments[0].languageCode, "uk");
    assert.deepEqual(getProductTranslations.mock.calls[0].arguments[0].locales, ["en"]);
    assert.deepEqual(calls, [
      "updateProductVariants",
      "updateShop",
      "markProductVariantSyncResults",
    ]);
    assert.deepEqual(updateShop.mock.calls[0].arguments, [
      SHOP,
      { defaultLanguageCode: "uk", defaultCurrency: "UAH" },
    ]);
  });
}

test("does not store the language when the request to Yespo throws", async () => {
  sendError = new Error("409");

  await assert.rejects(run(), /409/);

  assert.equal(updateProductVariants.mock.callCount(), 1);
  assert.equal(updateShop.mock.callCount(), 0);
});

test("does not store the language when there is nothing to send", async () => {
  syncRows = [
    {
      variantId: variant.id,
      syncFailed: false,
      syncedTagKeys: [],
      updatedAt: new Date(SHOPIFY_UPDATED_AT),
    },
  ];

  await run();

  assert.equal(updateProductVariants.mock.callCount(), 0);
  assert.equal(updateShop.mock.callCount(), 0);
});

test("keeps the stored language", async () => {
  defaultLanguageCode = "en";

  await run();

  assert.equal(updateProductVariants.mock.calls[0].arguments[0].languageCode, "en");
  assert.equal(getProductTranslations.mock.callCount(), 0);
  assert.equal(updateShop.mock.callCount(), 0);
});
