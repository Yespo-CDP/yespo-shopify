import assert from "node:assert/strict";
import test from "node:test";

import {
  countStorefrontHosts,
  readMarketId,
  shouldEnableMarketSync,
  shouldTrackMarketId,
} from "./market-tracking";

test("tracks a market when the metafield lists more than one storefront", () => {
  assert.equal(shouldTrackMarketId(2), true);
  assert.equal(shouldTrackMarketId(1), false);
  assert.equal(shouldTrackMarketId(0), false);
});

test("counts hosts stored in the multi-domain metafield", () => {
  assert.equal(
    countStorefrontHosts(
      JSON.stringify({ "a.example": "<script>", "b.example": "<script>" }),
    ),
    2,
  );
  assert.equal(
    countStorefrontHosts(JSON.stringify({ "a.example": "<script>" })),
    1,
  );
  assert.equal(countStorefrontHosts(null), 0);
  assert.equal(countStorefrontHosts(""), 0);
  assert.equal(countStorefrontHosts("not-json"), 0);
  assert.equal(countStorefrontHosts("[]"), 0);
});

test("enables market sync only when the shop has more than one market", () => {
  assert.equal(shouldEnableMarketSync(2), true);
  assert.equal(shouldEnableMarketSync(1), false);
  assert.equal(shouldEnableMarketSync(0), false);
});

test("keeps a lowercase market id and rejects anything else", () => {
  assert.equal(readMarketId("UA"), "ua");
  assert.equal(readMarketId(" lviv_center-2 "), "lviv_center-2");
  assert.equal(readMarketId(""), null);
  assert.equal(readMarketId("ua/kyiv"), null);
  assert.equal(readMarketId(null), null);
});
