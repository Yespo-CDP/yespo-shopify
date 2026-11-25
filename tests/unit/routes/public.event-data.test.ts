import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { beforeEach, mock, test } from "node:test";

const upsertCustomer = mock.fn(async (data: { customerId: string }) => data);
const createEventData = mock.fn(async (_data: unknown) => {});

// Test-only keys.
const KEY_A = "a".repeat(64);
const KEY_B = "b".repeat(64);
const SHOPS: Record<string, { id: number; publicApiKey: string | null }> = {
  "demo.myshopify.com": { id: 7, publicApiKey: KEY_A },
  "other.myshopify.com": { id: 8, publicApiKey: KEY_B },
  "nokey.myshopify.com": { id: 9, publicApiKey: null },
};
const getShopByDomain = mock.fn(async (domain: string) => SHOPS[domain] ?? null);

mock.module("../../../app/repositories/repositories.server", {
  namedExports: {
    customerRepository: { upsertCustomer },
    eventDataRepository: { createEventData },
    shopRepository: { getShopByDomain },
  },
});

const { action } = await import("../../../app/routes/public.event-data");

const post = (body: unknown) =>
  action({
    request: new Request("https://app.example/public/event-data", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  } as Parameters<typeof action>[0]);

const base = { shop: "demo.myshopify.com", sc: "sc-1", cartToken: "cart-1" };

const sign = (data: string, key = KEY_A) =>
  createHmac("sha256", key).update(data, "utf8").digest("hex");
const BUYER = {
  id: 123,
  email: "buyer@example.com",
  firstName: "Олена",
  lastName: "O'Neil",
  phone: null,
};
/** The part of the body that Liquid signs, as web-tracking.js sends it. */
const signed = (
  fields: { shop?: string; marketId?: string | null; customer?: unknown } = {},
  key = KEY_A,
) => {
  const signedData = JSON.stringify({
    shop: base.shop,
    marketId: "ua",
    customer: BUYER,
    ...fields,
  });
  return { signedData, signature: sign(signedData, key) };
};
const savedCart = () =>
  createEventData.mock.calls[0].arguments[0] as Record<string, unknown>;

/** Posts a body that has to be refused and returns what was logged. */
const refused = async (body: unknown) => {
  const error = mock.method(console, "error", () => {});
  try {
    const response = await post(body);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { success: false, error: "Invalid signature" });
    assert.equal(createEventData.mock.callCount(), 0);
    assert.equal(upsertCustomer.mock.callCount(), 0);
    assert.equal(error.mock.callCount(), 1);
    const line = error.mock.calls[0].arguments.map(String).join(" ");
    assert.doesNotMatch(line, /buyer@example|victim@example|Олена|[0-9a-f]{64}/);
    assert.doesNotMatch(line, /[\r\n]/);
    assert.equal(error.mock.calls[0].arguments.length, 1);
    return line;
  } finally {
    error.mock.restore();
  }
};

beforeEach(() => {
  upsertCustomer.mock.resetCalls();
  createEventData.mock.resetCalls();
  getShopByDomain.mock.resetCalls();
});

test("passes only the expected customer fields to upsertCustomer", async () => {
  const response = await post({
    ...base,
    ...signed({ customer: {
      id: 123,
      email: "buyer@example.com",
      phone: null,
      firstName: "Ann",
      lastName: { set: "x" },
      eventsData: { connect: { cartToken: "other-cart" } },
      shop: { create: { shopUrl: "evil.myshopify.com" } },
      createdAt: "2020-01-01",
    } }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(upsertCustomer.mock.calls[0].arguments[0], {
    customerId: "123",
    email: "buyer@example.com",
    phone: null,
    firstName: "Ann",
    lastName: undefined,
  });
  const eventData = createEventData.mock.calls[0].arguments[0] as Record<string, unknown>;
  assert.equal(eventData.customerId, "123");
  assert.equal(eventData.shopId, 7);
});

test("drops too long and missing customer fields", async () => {
  await post({
    ...base,
    ...signed({ customer: { id: "456", email: "a".repeat(256) } }),
  });

  assert.deepEqual(upsertCustomer.mock.calls[0].arguments[0], {
    customerId: "456",
    email: undefined,
    phone: undefined,
    firstName: undefined,
    lastName: undefined,
  });
});

test("ignores a customer with an invalid id but still saves the cart", async () => {
  for (const id of [undefined, "12a", { gt: 1 }, 1.5]) {
    await post({ ...base, ...signed({ customer: { id, email: "buyer@example.com" } }) });
  }

  assert.equal(upsertCustomer.mock.callCount(), 0);
  assert.equal(createEventData.mock.callCount(), 4);
  for (const call of createEventData.mock.calls) {
    const eventData = call.arguments[0] as Record<string, unknown>;
    assert.equal(eventData.customerId, undefined);
    assert.equal(eventData.cartToken, "cart-1");
  }
});

test("ignores a request whose shop, cartToken or sc is not a short string", async () => {
  await post({ ...base, shop: { not: "x" } });
  await post({ ...base, cartToken: { not: "x" } });
  await post({ ...base, sc: "s".repeat(256) });

  assert.equal(createEventData.mock.callCount(), 0);
  assert.equal(upsertCustomer.mock.callCount(), 0);
});

test("does not log the request body", async () => {
  const log = mock.method(console, "log", () => {});
  try {
    await post({ ...base, ...signed() });
    assert.equal(log.mock.callCount(), 0);
  } finally {
    log.mock.restore();
  }
});

test("valid signature: shop, marketId and customer come only from signedData", async () => {
  const response = await post({
    ...base,
    shop: "other.myshopify.com",
    marketId: "pl",
    customer: { id: 999, email: "victim@example.com" },
    ...signed(),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, error: null });
  assert.deepEqual(upsertCustomer.mock.calls.map((call) => call.arguments[0]), [
    {
      customerId: "123",
      email: "buyer@example.com",
      phone: null,
      firstName: "Олена",
      lastName: "O'Neil",
    },
  ]);
  const { ttl, ...cart } = savedCart();
  assert.ok(ttl instanceof Date);
  assert.deepEqual(cart, {
    cartToken: "cart-1",
    sc: "sc-1",
    marketId: "ua",
    shopId: 7,
    customerId: "123",
  });
});

test("valid signature of a guest: the body cannot add a customer or a market", async () => {
  await post({
    ...base,
    marketId: "pl",
    customer: { id: 999, email: "victim@example.com" },
    ...signed({ customer: null, marketId: null }),
  });

  assert.equal(upsertCustomer.mock.callCount(), 0);
  assert.equal(savedCart().customerId, undefined);
  assert.notEqual(savedCart().marketId, "pl");
});

test("valid signature works with any sc and cartToken and without the legacy fields", async () => {
  const response = await post({ sc: "sc-2", cartToken: "cart-2", ...signed() });

  assert.equal(response.status, 200);
  assert.equal(savedCart().cartToken, "cart-2");
  assert.equal(savedCart().sc, "sc-2");
  assert.equal(savedCart().customerId, "123");
});

for (const [label, fields] of [
  ["absent", {}],
  ["null", { signedData: null, signature: null }],
] as const) {
  test(`signature is ${label}: the cart is saved, the customer is ignored`, async () => {
    const response = await post({ ...base, marketId: "pl", customer: BUYER, ...fields });

    assert.equal(response.status, 200);
    assert.equal(upsertCustomer.mock.callCount(), 0);
    assert.equal(savedCart().customerId, undefined);
    assert.equal(savedCart().shopId, 7);
    assert.equal(savedCart().marketId, "pl");
  });
}

test("shop without a key: a signed request saves the cart without the customer", async () => {
  const shop = "nokey.myshopify.com";
  for (const fields of [
    signed({ shop }),
    signed({ shop }, ""),
    { ...signed({ shop }), signature: "bad" },
    { signedData: "not json", signature: "bad" },
    { signedData: "x".repeat(5000), signature: "bad" },
    { signature: "bad" },
  ]) {
    createEventData.mock.resetCalls();
    const response = await post({ ...base, shop, marketId: "pl", customer: BUYER, ...fields });

    assert.equal(response.status, 200);
    assert.equal(upsertCustomer.mock.callCount(), 0);
    assert.equal(savedCart().customerId, undefined);
    assert.equal(savedCart().shopId, 9);
    assert.equal(savedCart().marketId, "pl");
  }
});

const own = signed();
const guest = signed({ customer: null });
const victim = JSON.stringify({
  shop: base.shop,
  marketId: "ua",
  customer: { id: 999, email: "victim@example.com" },
});
const unparsed = "not json victim@example.com";
const noShop = JSON.stringify({ marketId: "ua", customer: BUYER });
const padded = own.signedData + " ".repeat(4097 - Buffer.byteLength(own.signedData));
for (const [label, fields] of [
  ["another customer with the buyer's own signature", { signedData: victim, signature: own.signature }],
  ["another customer with a guest signature", { signedData: victim, signature: guest.signature }],
  ["a signature made with another shop's key", signed({}, KEY_B)],
  ["a changed market", { signedData: own.signedData.replace('"ua"', '"pl"'), signature: own.signature }],
  ["a short signature", { ...own, signature: own.signature.slice(1) }],
  ["a non-hex signature", { ...own, signature: "z".repeat(64) }],
  ["an upper-case signature", { ...own, signature: own.signature.toUpperCase() }],
  ["a signature that is not a string", { ...own, signature: [own.signature] }],
  ["an empty signature", { ...own, signature: "" }],
  ["signedData that is not a string", { ...own, signedData: JSON.parse(own.signedData) }],
  ["only signedData", { signedData: own.signedData }],
  ["only a signature", { signature: own.signature }],
  ["signed text that is not JSON", { signedData: unparsed, signature: sign(unparsed) }],
  ["signed JSON null", { signedData: "null", signature: sign("null") }],
  ["signed JSON without a shop", { signedData: noShop, signature: sign(noShop) }],
  ["a signed shop that is not a string", signed({ shop: { not: "x" } as never })],
  ["a signed shop over 255 characters", signed({ shop: "s".repeat(256) })],
  ["signedData over 4 KB", { signedData: padded, signature: sign(padded) }],
] as [string, Record<string, unknown>][]) {
  test(`refuses ${label} with 400 and one log line without personal data`, async () => {
    const line = await refused({ ...base, customer: BUYER, ...fields });
    assert.match(line, /demo\.myshopify\.com/);
  });
}

test("accepts signedData of exactly 4 KB", async () => {
  const signedData = padded.slice(0, -1);
  const response = await post({ ...base, signedData, signature: sign(signedData) });

  assert.equal(response.status, 200);
  assert.equal(savedCart().customerId, "123");
});

test("the shop in signedData decides the key, not the shop in the body", async () => {
  await refused({ ...base, shop: "nokey.myshopify.com", ...signed({}, KEY_B) });
  await refused({ ...base, ...signed({ shop: "other.myshopify.com" }, KEY_A) });
});

test("the logged domain is short and has no line breaks", async () => {
  const domain = `evil\r\n\u2028\u001b[31m${"x".repeat(240)}`;
  SHOPS[domain] = { id: 1, publicApiKey: KEY_A };
  try {
    const line = await refused({ ...base, ...signed({ shop: domain }, KEY_B) });
    assert.ok(line.length < 200);
    assert.ok(!line.includes("\u2028") && !line.includes("\u001b"));
  } finally {
    delete SHOPS[domain];
  }
});

test("incomplete data and unknown shops are still answered with 200", async () => {
  const bad = { ...own, signature: "0".repeat(64) };
  for (const body of [
    { ...base, ...bad, sc: undefined },
    { ...base, ...bad, cartToken: undefined },
    { sc: "sc-1", cartToken: "cart-1", signedData: "not json", signature: "bad" },
    { ...base, ...signed({ shop: "unknown.myshopify.com" }) },
    { ...base, shop: "unknown.myshopify.com" },
  ]) {
    const response = await post(body);
    assert.equal(response.status, 200);
  }

  assert.equal(createEventData.mock.callCount(), 0);
  assert.equal(upsertCustomer.mock.callCount(), 0);
});

test("OPTIONS and CORS headers stay as they were", async () => {
  const options = await action({
    request: new Request("https://app.example/public/event-data", { method: "OPTIONS" }),
  } as Parameters<typeof action>[0]);
  assert.equal(options.status, 204);

  const error = mock.method(console, "error", () => {});
  const responses = [options, await post({ ...base, ...signed() }), await post({ ...base, ...signed({}, KEY_B) })];
  error.mock.restore();
  for (const { headers } of responses) {
    assert.equal(headers.get("Access-Control-Allow-Origin"), "*");
    assert.equal(headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
    assert.equal(headers.get("Access-Control-Allow-Headers"), "Content-Type");
  }
});
