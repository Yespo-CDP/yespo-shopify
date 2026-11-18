import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const SHOP = "demo.myshopify.com";
const OTHER = "old.myshopify.com";

const calls: string[] = [];
let session: unknown = { shop: SHOP };
let payload: Record<string, unknown> = {};
type Row = Record<string, unknown> | null;

let store: Row = null;
let holder: Row = null;

const getShop = mock.fn<(shopUrl: string) => Promise<Row>>(async () => store);
const getShopByDomain = mock.fn<(domain: string) => Promise<Row>>(async () => {
  calls.push("getShopByDomain");
  return holder;
});
const updateShop = mock.fn<(shopUrl: string, data: unknown) => Promise<Row>>(
  async (shopUrl) => {
    calls.push(`updateShop:${shopUrl}`);
    return {};
  },
);

mock.module("../../../app/shopify.server", {
  namedExports: {
    authenticate: {
      webhook: async () => ({ shop: SHOP, topic: "SHOP_UPDATE", session, payload }),
    },
  },
});
mock.module("../../../app/repositories/repositories.server", {
  namedExports: { shopRepository: { getShop, getShopByDomain, updateShop } },
});

mock.method(console, "log", () => {});

const { action } = await import("../../../app/routes/webhooks.app.shop_update");

const send = () =>
  action({
    request: new Request("https://app.example/webhooks/app/shop_update", { method: "POST" }),
  } as Parameters<typeof action>[0]);

beforeEach(() => {
  calls.length = 0;
  getShop.mock.resetCalls();
  getShopByDomain.mock.resetCalls();
  updateShop.mock.resetCalls();
  session = { shop: SHOP };
  payload = { email: "owner@shop.example", name: "Demo", domain: "brand.com" };
  store = { id: 7, shopUrl: SHOP, domain: "old-brand.com" };
  holder = null;
});

test("a free domain: updates the shop once", async () => {
  const response = await send();

  assert.equal(response.status, 200);
  assert.deepEqual(getShopByDomain.mock.calls[0].arguments, ["brand.com"]);
  assert.equal(updateShop.mock.callCount(), 1);
  assert.deepEqual(updateShop.mock.calls[0].arguments, [
    SHOP,
    { email: "owner@shop.example", name: "Demo", domain: "brand.com" },
  ]);
});

test("a domain held by another shop: frees it first, then updates the shop", async () => {
  holder = { id: 3, shopUrl: OTHER, domain: "brand.com" };

  const response = await send();

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["getShopByDomain", `updateShop:${OTHER}`, `updateShop:${SHOP}`]);
  assert.deepEqual(updateShop.mock.calls[0].arguments, [OTHER, { domain: OTHER }]);
  assert.deepEqual(updateShop.mock.calls[1].arguments, [
    SHOP,
    { email: "owner@shop.example", name: "Demo", domain: "brand.com" },
  ]);
});

test("a domain already held by this shop: no reset", async () => {
  holder = { id: 7, shopUrl: SHOP, domain: "brand.com" };

  const response = await send();

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["getShopByDomain", `updateShop:${SHOP}`]);
});

test("no domain in the payload: skips the holder lookup", async () => {
  payload = { email: "owner@shop.example", name: "Demo" };

  const response = await send();

  assert.equal(response.status, 200);
  assert.equal(getShopByDomain.mock.callCount(), 0);
  assert.deepEqual(updateShop.mock.calls[0].arguments, [
    SHOP,
    { email: "owner@shop.example", name: "Demo" },
  ]);
});

test("no session or no shop row: 200 without updates", async () => {
  session = undefined;
  assert.equal((await send()).status, 200);

  session = { shop: SHOP };
  store = null;
  assert.equal((await send()).status, 200);

  assert.equal(getShopByDomain.mock.callCount(), 0);
  assert.equal(updateShop.mock.callCount(), 0);
});
