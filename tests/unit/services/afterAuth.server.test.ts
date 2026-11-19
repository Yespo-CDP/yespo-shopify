import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const SHOP = "b.myshopify.com";
const OTHER_SHOP = "a.myshopify.com";
const DOMAIN = "brand.com";

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

const { default: afterAuth } = await import("../../../app/services/afterAuth.server");

const run = () =>
  afterAuth({ session: { shop: SHOP, scope: "" } as any, admin: {} });

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
    ],
  );
});

test("skips the domain lookup when the shop has no primary domain", async () => {
  shopData = { ...shopData, primaryDomain: null };

  await run();

  assert.equal(calls.filter((call) => call.name === "getShopByDomain").length, 0);
  assert.deepEqual(
    calls.map((call) => call.name),
    ["createShop"],
  );
});
