import assert from "node:assert/strict";
import test from "node:test";

import { readMarketId, shouldTrackMarketId } from "./market-tracking";

test("tracks a market only when sync is on and more than one market exists", () => {
  assert.equal(shouldTrackMarketId(true, 2), true);
  assert.equal(shouldTrackMarketId(true, 1), false);
  assert.equal(shouldTrackMarketId(true, 0), false);
  assert.equal(shouldTrackMarketId(false, 3), false);
  assert.equal(shouldTrackMarketId(null, 2), false);
  assert.equal(shouldTrackMarketId(undefined, 2), false);
});

test("keeps a lowercase market id and rejects anything else", () => {
  assert.equal(readMarketId("UA"), "ua");
  assert.equal(readMarketId(" lviv_center-2 "), "lviv_center-2");
  assert.equal(readMarketId(""), null);
  assert.equal(readMarketId("ua/kyiv"), null);
  assert.equal(readMarketId(null), null);
});
