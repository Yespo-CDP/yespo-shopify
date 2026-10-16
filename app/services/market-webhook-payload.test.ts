import assert from "node:assert/strict";
import test from "node:test";

import {
  isActiveMarketStatus,
  marketGidFromWebhook,
} from "./market-webhook-payload";

test("reads a numeric markets/create id as a Market gid", () => {
  assert.equal(
    marketGidFromWebhook({
      id: 188558248,
      name: "United States",
      status: "active",
    }),
    "gid://shopify/Market/188558248",
  );
});

test("keeps a Market gid already present on the payload", () => {
  assert.equal(
    marketGidFromWebhook({
      admin_graphql_api_id: "gid://shopify/Market/15",
    }),
    "gid://shopify/Market/15",
  );
});

test("returns null when the create payload has no market id", () => {
  assert.equal(marketGidFromWebhook({ name: "United States" }), null);
  assert.equal(marketGidFromWebhook(null), null);
});

test("treats an active or missing status as syncable", () => {
  assert.equal(isActiveMarketStatus({ status: "active" }), true);
  assert.equal(isActiveMarketStatus({ status: "ACTIVE" }), true);
  assert.equal(isActiveMarketStatus({}), true);
});

test("skips a draft market", () => {
  assert.equal(isActiveMarketStatus({ status: "draft" }), false);
});
