import assert from "node:assert/strict";
import test from "node:test";

import {
  marketSyncRowsRemovedFromCatalog,
  variantIdsPresentInCountry,
} from "./catalog-removed-variants";

test("staged rows mark a variant present even without a sendable price", () => {
  const present = variantIdsPresentInCountry([
    { variantId: "gid://shopify/ProductVariant/101", countryCode: "UA" },
    { variantId: "gid://shopify/ProductVariant/102", countryCode: "UA" },
    { variantId: null, countryCode: "UA" },
    { variantId: "gid://shopify/ProductVariant/101", countryCode: "PL" },
  ]);

  assert.deepEqual(
    [...(present.get("UA") ?? [])].sort(),
    [
      "gid://shopify/ProductVariant/101",
      "gid://shopify/ProductVariant/102",
    ],
  );
  assert.equal(present.get("PL")?.size, 1);
});

test("synced variants missing from the catalog are the ones to mark out of stock", () => {
  const present = new Set(["gid://shopify/ProductVariant/101"]);
  const removed = marketSyncRowsRemovedFromCatalog(
    [
      { variantId: "gid://shopify/ProductVariant/101", countryCode: "UA" },
      { variantId: "gid://shopify/ProductVariant/103", countryCode: "UA" },
    ],
    present,
  );

  assert.deepEqual(removed, [
    { variantId: "gid://shopify/ProductVariant/103", countryCode: "UA" },
  ]);
});
