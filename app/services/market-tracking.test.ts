import assert from "node:assert/strict";
import test from "node:test";

import {
  contactMarketId,
  readMarketId,
  shouldEnableMarketSync,
} from "./market-tracking";

test("enables market sync only when the shop has more than one market", () => {
  assert.equal(shouldEnableMarketSync(2), true);
  assert.equal(shouldEnableMarketSync(1), false);
  assert.equal(shouldEnableMarketSync(0), false);
});

test("uses the customer country as marketId for any shop", () => {
  assert.equal(contactMarketId("UA"), "ua");
  assert.equal(contactMarketId(" ua "), "ua");
  assert.equal(contactMarketId(null), undefined);
  assert.equal(contactMarketId(""), undefined);
});

test("keeps a lowercase market id and rejects anything else", () => {
  assert.equal(readMarketId("UA"), "ua");
  assert.equal(readMarketId(" lviv_center-2 "), "lviv_center-2");
  assert.equal(readMarketId(""), null);
  assert.equal(readMarketId("ua/kyiv"), null);
  assert.equal(readMarketId(null), null);
});
