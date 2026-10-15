import assert from "node:assert/strict";
import test from "node:test";

import {
  orderMarketIdCandidate,
  readOrderCartToken,
} from "./resolve-order-market-id";

test("prefers the stored visit market over the shipping country", () => {
  assert.equal(
    orderMarketIdCandidate({
      storedMarketId: "ca",
      shippingCountryCode: "US",
      billingCountryCode: "UA",
    }),
    "ca",
  );
});

test("uses the shipping country when the visit has no market", () => {
  assert.equal(
    orderMarketIdCandidate({
      storedMarketId: null,
      shippingCountryCode: "US",
      billingCountryCode: "UA",
    }),
    "us",
  );
});

test("uses the billing country when there is no shipping address", () => {
  assert.equal(
    orderMarketIdCandidate({
      billingCountryCode: "DE",
      customerCountryCode: "FR",
    }),
    "de",
  );
});

test("uses the customer country when shipping and billing are absent", () => {
  assert.equal(
    orderMarketIdCandidate({
      customerCountryCode: "PL",
    }),
    "pl",
  );
});

test("skips an invalid visit market and falls back to the address", () => {
  assert.equal(
    orderMarketIdCandidate({
      storedMarketId: "ua/kyiv",
      shippingCountryCode: "UA",
    }),
    "ua",
  );
});

test("returns null when no country is usable", () => {
  assert.equal(
    orderMarketIdCandidate({
      storedMarketId: "",
      shippingCountryCode: null,
    }),
    null,
  );
});

test("reads the cart token and drops the key suffix", () => {
  assert.equal(
    readOrderCartToken({ cart_token: "abc123?key=secret" }),
    "abc123",
  );
});

test("reads the cart token from note attributes when the field is empty", () => {
  assert.equal(
    readOrderCartToken({
      cart_token: null,
      note_attributes: [{ name: "Cart Token", value: "from-note?key=secret" }],
    }),
    "from-note",
  );
});
