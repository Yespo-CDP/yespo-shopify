import assert from "node:assert/strict";
import test from "node:test";

import { hasReadMarketsScope } from "./market-scopes";

test("accepts a comma-separated session scope string", () => {
  assert.equal(
    hasReadMarketsScope(
      "read_products,read_markets,read_themes",
    ),
    true,
  );
});

test("accepts the scopes_update webhook array", () => {
  assert.equal(hasReadMarketsScope(["read_themes", "read_markets"]), true);
});

test("rejects a session that is still missing read_markets", () => {
  assert.equal(
    hasReadMarketsScope("read_products,read_themes,read_locales"),
    false,
  );
});

test("rejects empty scopes", () => {
  assert.equal(hasReadMarketsScope(null), false);
  assert.equal(hasReadMarketsScope(""), false);
  assert.equal(hasReadMarketsScope([]), false);
});
