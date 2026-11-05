import assert from "node:assert/strict";
import { mock, test } from "node:test";

/**
 * Shopify Admin API rejects `nodes(ids:)` arrays larger than 250.
 * @see https://shopify.dev/docs/api/usage/limits#input-limits
 */
const SHOPIFY_INPUT_ARRAY_LIMIT = 250;

const request = mock.fn(
  async (_query: string, options: { variables: { ids: string[] } }) => {
    const ids = options.variables.ids;
    return {
      data: {
        nodes: ids.map((gid) => ({
          id: gid,
          image: { url: `https://cdn.example/${gid.split("/").pop()}.jpg` },
          product: {
            handle: "item",
            onlineStoreUrl: "https://shop.example/products/item",
            featuredImage: null,
          },
        })),
      },
    };
  },
);

mock.module("~/services/get-offline-session.server", {
  namedExports: {
    getOfflineAccessToken: async () => "offline-token",
  },
});

mock.module("~/worker/services/create-client", {
  namedExports: {
    createClient: () => ({ request }),
  },
});

const { getOrderItemProducts } =
  await import("./get-order-item-products.server.ts");

test("loads product links for more than 250 variants in batches of at most 250", async () => {
  const variantIds = Array.from(
    { length: SHOPIFY_INPUT_ARRAY_LIMIT + 1 },
    (_, index) => String(index + 1),
  );

  const links = await getOrderItemProducts({
    shopUrl: "demo.myshopify.com",
    shopDomain: "shop.example",
    variantIds,
  });

  const batches = request.mock.calls.map(
    (call) =>
      (call.arguments[1] as { variables: { ids: string[] } }).variables.ids,
  );

  assert.ok(batches.length > 1);
  for (const batch of batches) {
    assert.ok(batch.length <= SHOPIFY_INPUT_ARRAY_LIMIT);
    assert.ok(batch.length > 0);
  }
  assert.equal(
    batches.flat().length,
    variantIds.length,
    "every variant id is requested exactly once",
  );

  assert.equal(links.size, variantIds.length);
  for (const variantId of variantIds) {
    const link = links.get(variantId);
    assert.equal(link?.imageUrl, `https://cdn.example/${variantId}.jpg`);
    assert.equal(
      link?.url,
      `https://shop.example/products/item?variant=${variantId}`,
    );
  }
});
