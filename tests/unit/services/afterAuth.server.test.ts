import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const SHOP = "b.myshopify.com";
const OTHER_SHOP = "a.myshopify.com";
const DOMAIN = "brand.com";
const ADMIN = {};

const calls: { name: string; args: unknown[] }[] = [];
const record =
  (name: string, result?: (...args: any[]) => unknown) =>
  async (...args: any[]) => {
    calls.push({ name, args });
    return result?.(...args);
  };

let shopData: Record<string, unknown> | null = null;
let existingShop: Record<string, unknown> | null = null;
let domainHolder: Record<string, unknown> | null = null;

mock.module("../../../app/shopify/queries/get-shop.server", {
  defaultExport: async () => shopData,
});
mock.module("../../../app/repositories/repositories.server", {
  namedExports: {
    shopRepository: {
      getShop: async () => existingShop,
      getShopByDomain: record("getShopByDomain", () => domainHolder),
      updateShop: record("updateShop"),
      createShop: record("createShop"),
    },
  },
});
mock.module("../../../app/shopify.server", {
  defaultExport: { registerWebhooks: () => {} },
});
mock.module("../../../app/shopify/queries/get-metafield-definition", {
  defaultExport: async () => ({ id: "definition" }),
});
mock.module("../../../app/shopify/mutations/create-metafield-definition.server", {
  defaultExport: async () => {},
});
mock.module("../../../app/shopify/mutations/delete-metafields.server", {
  defaultExport: async () => {},
});
mock.module("../../../app/services/ensure-web-push-multi-domain.server", {
  namedExports: { ensureWebPushMultiDomain: async () => "skipped" },
});
let keyError: unknown = null;
const ensureShopPublicApiKey = mock.fn<(args: unknown) => Promise<void>>(async () => {
  calls.push({ name: "ensureShopPublicApiKey", args: [] });
  if (keyError) throw keyError;
});
mock.module("../../../app/services/ensure-shop-public-api-key.server", {
  namedExports: { ensureShopPublicApiKey },
});

const { default: afterAuth } = await import("../../../app/services/afterAuth.server");

const run = () =>
  afterAuth({ session: { shop: SHOP, scope: "" } as any, admin: ADMIN });

beforeEach(() => {
  calls.length = 0;
  shopData = {
    id: "gid://shopify/Shop/2",
    myshopifyDomain: SHOP,
    name: "B",
    email: "b@example.com",
    primaryDomain: { id: "gid://shopify/Domain/1", host: DOMAIN },
  };
  existingShop = null;
  domainHolder = null;
  keyError = null;
  ensureShopPublicApiKey.mock.resetCalls();
});

test("frees the domain held by another shop row before creating the shop", async () => {
  domainHolder = { shopUrl: OTHER_SHOP, domain: DOMAIN };

  await run();

  assert.deepEqual(calls, [
    { name: "getShopByDomain", args: [DOMAIN] },
    { name: "updateShop", args: [OTHER_SHOP, { domain: OTHER_SHOP }] },
    {
      name: "createShop",
      args: [
        {
          shopUrl: SHOP,
          shopId: "gid://shopify/Shop/2",
          name: "B",
          email: "b@example.com",
          domain: DOMAIN,
          syncedLocales: [],
        },
      ],
    },
    { name: "ensureShopPublicApiKey", args: [] },
  ]);
});

test("does not free the domain when this shop already holds it", async () => {
  existingShop = { shopUrl: SHOP, domain: DOMAIN, apiKey: "key" };
  domainHolder = existingShop;

  await run();

  assert.deepEqual(
    calls.filter((call) => call.name !== "getShopByDomain"),
    [
      {
        name: "updateShop",
        args: [
          SHOP,
          { name: "B", email: "b@example.com", domain: DOMAIN, active: true },
        ],
      },
      { name: "ensureShopPublicApiKey", args: [] },
    ],
  );
});

test("skips the domain lookup when the shop has no primary domain", async () => {
  shopData = { ...shopData, primaryDomain: null };

  await run();

  assert.equal(calls.filter((call) => call.name === "getShopByDomain").length, 0);
  assert.deepEqual(
    calls.map((call) => call.name),
    ["createShop", "ensureShopPublicApiKey"],
  );
});

test("always writes the event key, also for a shop that already has one", async () => {
  existingShop = { shopUrl: SHOP, domain: DOMAIN, apiKey: "key", publicApiKey: "old" };

  await run();

  assert.equal(ensureShopPublicApiKey.mock.callCount(), 1);
  const args = ensureShopPublicApiKey.mock.calls[0].arguments[0] as Record<string, unknown>;
  assert.deepEqual(args, { admin: ADMIN, shopUrl: SHOP, shopGid: "gid://shopify/Shop/2" });
  assert.equal(args.admin, ADMIN);
});

test("a failed event key does not break the install", async () => {
  const consoleError = mock.method(console, "error", () => {});

  try {
    keyError = new Error("SHOP_ENCRYPTION_KEY is not set");
    await run();

    assert.equal(ensureShopPublicApiKey.mock.callCount(), 1);
    assert.deepEqual(
      consoleError.mock.calls.map((call) => call.arguments),
      [[`Event key setup failed for ${SHOP}:`, "SHOP_ENCRYPTION_KEY is not set"]],
    );
  } finally {
    consoleError.mock.restore();
  }
});
