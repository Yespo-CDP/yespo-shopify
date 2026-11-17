import assert from "node:assert/strict";
import { mock, test } from "node:test";

const createOrUpdate = mock.fn(async (_data: unknown) => ({}));

const variant = (id: string) => ({
  variantId: `gid://shopify/ProductVariant/${id}`,
  updatedAt: "2026-01-01T00:00:00Z",
  inventoryQuantity: 1,
  perCountry: { US: { price: { amount: "10", currencyCode: "USD" } } },
});

mock.module("../../../app/repositories/repositories.server", {
  namedExports: {
    marketSyncRepository: {
      getSyncedCountryCodes: async () => ["US"],
      getByKeys: async () => [],
      createOrUpdate,
    },
    shopMarketRepository: { getByShopId: async () => [] },
  },
});
mock.module("../../../app/api/update-market-products", {
  namedExports: {
    updateMarketProducts: async () => ({ id: 1, failedItems: ["2"] }),
  },
});
mock.module("../../../app/worker/services/create-client", {
  namedExports: { createClient: () => ({}) },
});
mock.module("../../../app/worker/services/fetch-shop-markets-config", {
  namedExports: {
    fetchShopMarketsConfig: async () => ({ countries: ["US"], markets: [] }),
  },
});
mock.module("../../../app/worker/services/get-product-contextual-pricing", {
  namedExports: {
    getProductContextualPricing: async () => ({
      handle: "shirt",
      publishedInCountry: { US: true },
      variants: [variant("1"), variant("2")],
    }),
  },
});

const { updateMarketFromWebhook } = await import(
  "../../../app/services/update-market-from-webhook.server"
);

test("does not store the hash of a variant Yespo rejected", async () => {
  await updateMarketFromWebhook({
    shopId: 1,
    shopifyDomain: "demo.myshopify.com",
    accessToken: "token",
    productGid: "gid://shopify/Product/10",
    isMarketSyncEnabled: true,
    apiKey: "key",
    siteId: "site",
    domain: "demo.com",
  });

  assert.deepEqual(
    createOrUpdate.mock.calls.map(
      (call) => (call.arguments[0] as { variantId: string }).variantId,
    ),
    ["gid://shopify/ProductVariant/1"],
  );
});
