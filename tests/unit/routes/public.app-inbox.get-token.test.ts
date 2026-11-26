import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { beforeEach, mock, test } from "node:test";

const getContactToken = mock.fn(async () => "contact-token");

// Test-only keys.
const KEY_A = "a".repeat(64);
const KEY_B = "b".repeat(64);
const SHOP = {
  apiKey: "yespo-key",
  isAppInboxEnabled: true as boolean | null,
  publicApiKey: KEY_A as string | null,
};
const SHOPS: Record<string, typeof SHOP> = {
  "demo.myshopify.com": SHOP,
  "nokey.myshopify.com": { ...SHOP, publicApiKey: null },
  "noapi.myshopify.com": { ...SHOP, apiKey: "" },
  "off.myshopify.com": { ...SHOP, isAppInboxEnabled: false },
  "unset.myshopify.com": { ...SHOP, isAppInboxEnabled: null },
};
const getShopByDomain = mock.fn(async (domain: string) => SHOPS[domain] ?? null);

mock.module("../../../app/repositories/repositories.server", {
  namedExports: { shopRepository: { getShopByDomain } },
});
mock.module("../../../app/services/get-contact-token.server", {
  namedExports: { getContactToken },
});

const { action } = await import("../../../app/routes/public.app-inbox.get-token");

const post = (body: unknown) =>
  action({
    request: new Request("https://app.example/public/app-inbox/get-token", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  } as Parameters<typeof action>[0]);

const sign = (data: string, key = KEY_A) =>
  createHmac("sha256", key).update(data, "utf8").digest("hex");
const BUYER = { id: 123, email: "buyer@example.com", firstName: "Олена", lastName: null, phone: "+380000000000" };
/** The body that yespoAppAuthCallback sends. */
const signed = (fields: { shop?: string; customer?: unknown } = {}, key = KEY_A) => {
  const signedData = JSON.stringify({ shop: "demo.myshopify.com", marketId: "ua", customer: BUYER, ...fields });
  return { signedData, signature: sign(signedData, key) };
};

const noToken = async (body: unknown) => {
  const response = await post(body);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, token: "" });
  assert.equal(getContactToken.mock.callCount(), 0);
};

/** Posts a body that has to be refused and returns what was logged. */
const refused = async (body: unknown) => {
  const error = mock.method(console, "error", () => {});
  try {
    const response = await post(body);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { success: false, error: "Invalid signature" });
    assert.equal(getContactToken.mock.callCount(), 0);
    assert.equal(error.mock.callCount(), 1);
    const line = error.mock.calls[0].arguments.map(String).join(" ");
    assert.doesNotMatch(line, /buyer@example|victim@example|[0-9a-f]{64}/);
    return line;
  } finally {
    error.mock.restore();
  }
};

beforeEach(() => {
  getContactToken.mock.resetCalls();
  getShopByDomain.mock.resetCalls();
});

test("valid signature: the token is requested for the customer from signedData only", async () => {
  const response = await post({
    ...signed(),
    shop: "off.myshopify.com",
    externalCustomerId: 999,
    email: "victim@example.com",
    phone: "+1",
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, token: "contact-token" });
  assert.equal(getShopByDomain.mock.calls[0].arguments[0], "demo.myshopify.com");
  assert.deepEqual(getContactToken.mock.calls.map((call) => call.arguments), [
    ["yespo-key", { externalCustomerId: "123", email: "buyer@example.com", phone: "+380000000000" }],
  ]);
});

test("refuses a changed signedData", async () => {
  const own = signed();
  const line = await refused({ ...own, signedData: own.signedData.replace("buyer@", "victim@") });
  assert.match(line, /demo\.myshopify\.com/);
});

test("refuses a signature made with another shop's key", async () => {
  await refused(signed({}, KEY_B));
});

test("refuses signedData without a signature and unusable signedData", async () => {
  await refused({ signedData: signed().signedData });
  await refused({ signature: signed().signature });
  await refused({ signedData: "not json", signature: sign("not json") });
  await refused({ ...signed(), signedData: JSON.parse(signed().signedData) });
});

test("no signature: empty token without a request to Yespo", async () => {
  await noToken({ shop: "demo.myshopify.com", externalCustomerId: 123, email: "buyer@example.com" });
  await noToken({ signedData: null, signature: null });
});

test("shop without a key, an API key or enabled App Inbox: empty token", async () => {
  for (const shop of ["nokey", "noapi", "off", "unset", "unknown"]) {
    await noToken(signed({ shop: `${shop}.myshopify.com` }));
  }
});

test("signed guest: empty token", async () => {
  await noToken(signed({ customer: null }));
});

test("OPTIONS is answered with 204", async () => {
  const response = await action({
    request: new Request("https://app.example/public/app-inbox/get-token", { method: "OPTIONS" }),
  } as Parameters<typeof action>[0]);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
});

test("an internal error is answered with a generic text and logged without its message", async () => {
  getContactToken.mock.mockImplementationOnce(async () => {
    throw Object.assign(new Error("Yespo refused buyer@example.com"), { code: "ECONNRESET" });
  });
  const error = mock.method(console, "error", () => {});
  try {
    const response = await post(signed());

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { success: false, error: "Bad request" });
    assert.deepEqual(error.mock.calls.map((call) => call.arguments), [
      ["Failed to get contact auth token: Error ECONNRESET"],
    ]);
  } finally {
    error.mock.restore();
  }
});

test("a body that is not JSON is answered with a generic text", async () => {
  const error = mock.method(console, "error", () => {});
  try {
    const response = await action({
      request: new Request("https://app.example/public/app-inbox/get-token", {
        method: "POST",
        body: "{buyer@example.com",
      }),
    } as Parameters<typeof action>[0]);

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { success: false, error: "Bad request" });
    assert.deepEqual(error.mock.calls.map((call) => call.arguments), [
      ["Failed to get contact auth token: SyntaxError"],
    ]);
  } finally {
    error.mock.restore();
  }
});
