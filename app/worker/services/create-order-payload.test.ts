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

test("uses presentment money and currency when the buyer market differs", () => {
  const payload = createOrderPayload(
    order({
      currencyCode: "UAH",
      presentmentCurrencyCode: "USD",
      totalPriceSet: {
        shopMoney: { amount: "4000.00", currencyCode: "UAH" },
        presentmentMoney: { amount: "100.00", currencyCode: "USD" },
      },
      totalDiscountsSet: {
        shopMoney: { amount: "400.00", currencyCode: "UAH" },
        presentmentMoney: { amount: "10.00", currencyCode: "USD" },
      },
      totalShippingPriceSet: {
        shopMoney: { amount: "200.00", currencyCode: "UAH" },
        presentmentMoney: { amount: "5.00", currencyCode: "USD" },
      },
      totalTaxSet: {
        shopMoney: { amount: "80.00", currencyCode: "UAH" },
        presentmentMoney: { amount: "2.00", currencyCode: "USD" },
      },
      lineItems: {
        nodes: [
          {
            id: "gid://shopify/LineItem/1",
            name: "Shirt",
            quantity: 1,
            originalTotalSet: {
              shopMoney: { amount: "4000.00", currencyCode: "UAH" },
              presentmentMoney: { amount: "100.00", currencyCode: "USD" },
            },
          },
        ],
      },
    }),
  );

  assert.equal(payload.currency, "USD");
  assert.equal(payload.totalCost, 100);
  assert.equal(payload.discount, 10);
  assert.equal(payload.shipping, 5);
  assert.equal(payload.taxes, 2);
  assert.equal(payload.items[0]?.cost, 100);
});

test("falls back to shop money when presentment money is absent", () => {
  const payload = createOrderPayload(
    order({
      currencyCode: "UAH",
      totalPriceSet: {
        shopMoney: { amount: "250.00", currencyCode: "UAH" },
      },
    }),
  );

  assert.equal(payload.currency, "UAH");
  assert.equal(payload.totalCost, 250);
});

test("appends the variant id to the item storefront url", () => {
  const payload = createOrderPayload(
    order({
      lineItems: {
        nodes: [
          {
            id: "gid://shopify/LineItem/1",
            name: "Shirt",
            quantity: 1,
            variant: {
              id: "gid://shopify/ProductVariant/430738",
              product: {
                handle: "cool-socks",
                onlineStoreUrl: "https://shop.example/products/cool-socks",
              },
            },
          },
          {
            id: "gid://shopify/LineItem/2",
            name: "Hat",
            quantity: 1,
            variant: {
              id: "gid://shopify/ProductVariant/99",
              product: {
                handle: "wool-hat",
                onlineStoreUrl: "https://shop.example/products/wool-hat?utm=order",
              },
            },
          },
          {
            id: "gid://shopify/LineItem/3",
            name: "Scarf",
            quantity: 1,
            variant: {
              id: "gid://shopify/ProductVariant/7",
              product: { handle: "silk-scarf" },
            },
          },
          {
            id: "gid://shopify/LineItem/4",
            name: "Deleted variant",
            quantity: 1,
            variant: {
              id: "gid://shopify/ProductVariant/",
              product: {
                handle: "plain-tee",
                onlineStoreUrl: "https://shop.example/products/plain-tee",
              },
            },
          },
        ],
      },
    }),
    "shop.example",
  );

  assert.equal(
    payload.items[0]?.url,
    "https://shop.example/products/cool-socks?variant=430738",
  );
  assert.equal(
    payload.items[1]?.url,
    "https://shop.example/products/wool-hat?utm=order&variant=99",
  );
  assert.equal(
    payload.items[2]?.url,
    "https://shop.example/products/silk-scarf?variant=7",
  );
  assert.equal(
    payload.items[3]?.url,
    "https://shop.example/products/plain-tee",
  );
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
