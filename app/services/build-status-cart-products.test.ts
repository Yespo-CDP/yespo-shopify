import assert from "node:assert/strict";
import test from "node:test";

import { buildStatusCartProducts } from "./build-status-cart-products";

const line = (overrides: Record<string, unknown> = {}) => ({
  id: 111,
  variant_id: 111,
  quantity: 2,
  price: "100.00",
  original_price: "100.00",
  total_discount: "20.00",
  price_set: {
    shop_money: { amount: "100.00", currency_code: "UAH" },
    presentment_money: { amount: "100.00", currency_code: "UAH" },
  },
  total_discount_set: {
    shop_money: { amount: "20.00", currency_code: "UAH" },
    presentment_money: { amount: "20.00", currency_code: "UAH" },
  },
  ...overrides,
});

test("uses the market price when the webhook money is in the shop currency", () => {
  const [product] = buildStatusCartProducts(
    [line()],
    new Map([["111", { amount: "2.50", currencyCode: "USD" }]]),
  );

  assert.equal(product.price, "2.50");
  assert.equal(product.price_currency_code, "USD");
  // 10 UAH per unit * (2.5 / 100)
  assert.equal(product.discount, "0.25");
});

test("keeps webhook presentment money when it already matches the market currency", () => {
  const [product] = buildStatusCartProducts(
    [
      line({
        price_set: {
          shop_money: { amount: "100.00", currency_code: "UAH" },
          presentment_money: { amount: "2.40", currency_code: "USD" },
        },
        total_discount_set: {
          shop_money: { amount: "20.00", currency_code: "UAH" },
          presentment_money: { amount: "0.50", currency_code: "USD" },
        },
      }),
    ],
    new Map([["111", { amount: "2.50", currencyCode: "USD" }]]),
  );

  assert.equal(product.price, "2.40");
  assert.equal(product.price_currency_code, "USD");
  assert.equal(product.discount, "0.25");
});

test("falls back to the webhook values without a market price", () => {
  const [product] = buildStatusCartProducts([line()]);

  assert.equal(product.price, "100.00");
  assert.equal(product.price_currency_code, "UAH");
  assert.equal(product.discount, "10.00");
});
