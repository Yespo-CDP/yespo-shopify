import assert from "node:assert/strict";
import test from "node:test";

import type { OrderData } from "~/@types/order";
import { createOrderPayload } from "./create-order-payload";

function order(overrides: Partial<OrderData> = {}): OrderData {
  return {
    id: "gid://shopify/Order/1",
    currencyCode: "USD",
    displayFulfillmentStatus: "UNFULFILLED",
    lineItems: { nodes: [] },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

test("uses the shipping country as marketId", () => {
  const payload = createOrderPayload(
    order({
      shippingAddress: { id: "ship", countryCodeV2: "US" },
      billingAddress: { countryCodeV2: "UA" },
    }),
    "shop.example",
  );

  assert.equal(payload.marketId, "us");
});

test("uses the billing country when the order has no shipping address", () => {
  const payload = createOrderPayload(
    order({
      billingAddress: { countryCodeV2: "DE" },
      customer: {
        id: "gid://shopify/Customer/1",
        firstName: "A",
        lastName: "B",
        defaultAddress: { id: "addr", countryCodeV2: "FR" },
      },
    }),
    "shop.example",
  );

  assert.equal(payload.marketId, "de");
});

test("uses the customer country when shipping and billing are absent", () => {
  const payload = createOrderPayload(
    order({
      customer: {
        id: "gid://shopify/Customer/1",
        firstName: "A",
        lastName: "B",
        defaultAddress: { id: "addr", countryCodeV2: "PL" },
      },
    }),
    "shop.example",
  );

  assert.equal(payload.marketId, "pl");
});

test("sets marketId from the shipping country for a single-market shop", () => {
  const payload = createOrderPayload(
    order({
      shippingAddress: { id: "ship", countryCodeV2: "US" },
    }),
    "shop.example",
  );

  assert.equal(payload.marketId, "us");
});
