import assert from "node:assert/strict";
import test from "node:test";

import {
  isPublishedInAnyMarket,
  resolveVariantIsInStock,
} from "./resolve-variant-is-in-stock";

test("one market: in stock and published is 1", () => {
  assert.equal(isPublishedInAnyMarket({ CA: true }), true);
  assert.equal(resolveVariantIsInStock(5, true), 1);
});

test("one market: in stock but not published is 0", () => {
  assert.equal(isPublishedInAnyMarket({ CA: false }), false);
  assert.equal(resolveVariantIsInStock(5, false), 0);
});

test("several markets: published in at least one is 1", () => {
  assert.equal(isPublishedInAnyMarket({ CA: false, UA: true }), true);
  assert.equal(resolveVariantIsInStock(1, true), 1);
});

test("several markets: in stock but published nowhere is 0", () => {
  assert.equal(isPublishedInAnyMarket({ CA: false, UA: false }), false);
  assert.equal(resolveVariantIsInStock(10, false), 0);
});

test("published but quantity is zero is 0", () => {
  assert.equal(resolveVariantIsInStock(0, true), 0);
});

test("untracked inventory counts as in stock when published", () => {
  assert.equal(resolveVariantIsInStock(null, true), 1);
  assert.equal(resolveVariantIsInStock(null, false), 0);
});
