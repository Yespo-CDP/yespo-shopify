import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { afterEach, beforeEach, mock, test } from "node:test";
import { inspect } from "node:util";

const SHOP = "demo.myshopify.com";
const SHOP_GID = "gid://shopify/Shop/42";
const INSTALLATION_GID = "gid://shopify/AppInstallation/1";
const ENV_KEY = randomBytes(32);
const SHOP_KEY = createHmac("sha256", ENV_KEY).update("42").digest("hex");
process.env.SHOP_ENCRYPTION_KEY = ENV_KEY.toString("base64");

const calls: string[] = [];
const requests: { query: string; variables?: unknown }[] = [];
let installation: unknown;
let metafieldsSet: () => unknown;
let updateError: Error | null = null;

const updateShop = mock.fn<(shopUrl: string, data: unknown) => Promise<void>>(async () => {
  calls.push("updateShop");
  if (updateError) throw updateError;
});
mock.module("../../../app/repositories/repositories.server", {
  namedExports: { shopRepository: { updateShop } },
});

const { ensureShopPublicApiKey } = await import(
  "../../../app/services/ensure-shop-public-api-key.server"
);

const admin = {
  graphql: async (query: string, options?: { variables?: unknown }) => {
    requests.push({ query, variables: options?.variables });
    if (query.includes("currentAppInstallation")) {
      calls.push("currentAppInstallation");
      return Response.json({ data: { currentAppInstallation: installation } });
    }
    calls.push("metafieldsSet");
    return Response.json({ data: { metafieldsSet: metafieldsSet() } });
  },
};
const run = () =>
  ensureShopPublicApiKey({ admin, shopUrl: SHOP, shopGid: SHOP_GID });

const logged: string[] = [];
for (const method of ["log", "info", "warn", "error", "debug"] as const) {
  mock.method(console, method, (...args: unknown[]) => {
    logged.push(inspect(args, { depth: null }));
  });
}
const fails = async () => {
  let failure: Error | undefined;
  await assert.rejects(run(), (error: Error) => {
    failure = error;
    return true;
  });
  const { message, stack, cause } = failure!;
  for (const text of [message, stack ?? "", String(cause)]) {
    assert.ok(!text.includes(SHOP_KEY), "the key is in the error");
  }
  assert.match(message, /demo\.myshopify\.com/);
  return message;
};

beforeEach(() => {
  calls.length = 0;
  requests.length = 0;
  logged.length = 0;
  updateShop.mock.resetCalls();
  updateError = null;
  installation = { id: INSTALLATION_GID };
  metafieldsSet = () => ({
    metafields: [{ id: "gid://shopify/Metafield/1" }],
    userErrors: [],
  });
});

afterEach(() => {
  for (const line of logged) assert.ok(!line.includes(SHOP_KEY), "the key is in the log");
});

test("writes the app-data metafield first, then the database", async () => {
  await run();

  assert.deepEqual(calls, ["currentAppInstallation", "metafieldsSet", "updateShop"]);
  assert.deepEqual(requests[1].variables, {
    metafields: [
      {
        ownerId: INSTALLATION_GID,
        namespace: "yespo",
        key: "yespo-event-key",
        type: "single_line_text_field",
        value: SHOP_KEY,
      },
    ],
  });
  assert.doesNotMatch(requests[1].query, /\bvalue\b/);
  assert.deepEqual(updateShop.mock.calls[0].arguments, [SHOP, { publicApiKey: SHOP_KEY }]);
});

for (const [label, result] of [
  ["userErrors", { metafields: [{ id: "1" }], userErrors: [{ field: ["metafields"], message: "Value is invalid" }] }],
  ["no metafield in the response", { metafields: [], userErrors: [] }],
  ["an empty response", null],
] as const) {
  test(`does not change the database on ${label}`, async () => {
    metafieldsSet = () => result;
    const message = await fails();
    assert.equal(updateShop.mock.callCount(), 0);
    if (label === "userErrors") assert.match(message, /Value is invalid/);
  });
}

test("does not write anything without an app installation id", async () => {
  installation = null;
  await fails();
  assert.deepEqual(calls, ["currentAppInstallation"]);
});

test("hides the key that Shopify or Prisma repeats in an error", async () => {
  metafieldsSet = () => {
    throw new Error(`Variable $metafields was provided invalid value ${SHOP_KEY}`);
  };
  assert.match(await fails(), /provided invalid value/);
  assert.equal(updateShop.mock.callCount(), 0);

  metafieldsSet = () => ({ metafields: [], userErrors: [{ message: `Bad value ${SHOP_KEY}` }] });
  assert.match(await fails(), /Bad value/);
  assert.equal(updateShop.mock.callCount(), 0);

  metafieldsSet = () => ({ metafields: [{ id: "1" }], userErrors: [] });
  updateError = new Error(`Invalid prisma.shop.update() { publicApiKey: "${SHOP_KEY}" }`);
  assert.match(await fails(), /Invalid prisma/);
});

test("an HTTP error is reported by its status", async () => {
  metafieldsSet = () => {
    throw new Response(SHOP_KEY, { status: 502 });
  };
  assert.match(await fails(), /HTTP 502/);
  assert.equal(updateShop.mock.callCount(), 0);
});

test("sends nothing when SHOP_ENCRYPTION_KEY is wrong", async () => {
  process.env.SHOP_ENCRYPTION_KEY = "";
  try {
    await assert.rejects(run(), /SHOP_ENCRYPTION_KEY/);
  } finally {
    process.env.SHOP_ENCRYPTION_KEY = ENV_KEY.toString("base64");
  }
  assert.deepEqual(calls, []);
});
