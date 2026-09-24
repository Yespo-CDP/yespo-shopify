import assert from "node:assert/strict";
import test from "node:test";

import { hasProductSyncScopes } from "./product-sync-scopes";

const granted =
  "read_customers,read_products,read_publications,read_translations,read_locales";

test("accepts a comma-separated session scope string", () => {
  assert.equal(hasProductSyncScopes(granted), true);
});

test("accepts the scopes_update webhook array", () => {
  assert.equal(
    hasProductSyncScopes([
      "read_products",
      "read_publications",
      "read_translations",
      "read_locales",
    ]),
    true,
  );
});

test("rejects a session that is still missing a product scope", () => {
  assert.equal(
    hasProductSyncScopes("read_products,read_publications,read_translations"),
    false,
  );
});

test("rejects empty scopes", () => {
  assert.equal(hasProductSyncScopes(null), false);
  assert.equal(hasProductSyncScopes(""), false);
  assert.equal(hasProductSyncScopes([]), false);
});
