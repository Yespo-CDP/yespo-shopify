import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const SHOP = "demo.myshopify.com";

const SYNC_MODELS = [
  "customerSync",
  "customerSyncLog",
  "orderSync",
  "orderSyncLog",
  "productVariantSync",
  "productVariantSyncLog",
  "marketSync",
  "marketSyncLog",
  "shopMarket",
  "tmpMarketSync",
] as const;

const calls: string[] = [];
let store: Record<string, unknown> | null = null;
let transactionError: Error | null = null;

const deleteAccessTokenService = mock.fn(async (_args: unknown) => {
  calls.push("deleteAccessToken");
});
const getShop = mock.fn(async (_shop: string) => store);
const transaction = mock.fn(async (operations: unknown[]) => {
  calls.push("$transaction");
  if (transactionError) throw transactionError;
  return operations;
});
const sessionDeleteMany = mock.fn(async (_args: unknown) => {
  calls.push("session.deleteMany");
  return { count: 1 };
});

mock.module("../../../app/shopify.server", {
  namedExports: {
    authenticate: {
      webhook: async () => ({ shop: SHOP, topic: "APP_UNINSTALLED", session: undefined }),
    },
  },
});
mock.module("../../../app/repositories/repositories.server", {
  namedExports: { shopRepository: { getShop } },
});
mock.module("../../../app/services/delete-access-token.server", {
  namedExports: { deleteAccessTokenService },
});
mock.module("../../../app/db.server", {
  defaultExport: {
    $transaction: transaction,
    session: { deleteMany: sessionDeleteMany },
    shop: { update: (args: unknown) => ({ op: "shop.update", args }) },
    ...Object.fromEntries(
      SYNC_MODELS.map((model) => [
        model,
        { deleteMany: (args: unknown) => ({ op: `${model}.deleteMany`, args }) },
      ]),
    ),
  },
});

mock.method(console, "log", () => {});

const { action } = await import("../../../app/routes/webhooks.app.uninstalled");

const send = () =>
  action({
    request: new Request("https://app.example/webhooks/app/uninstalled", { method: "POST" }),
  } as Parameters<typeof action>[0]);

beforeEach(() => {
  calls.length = 0;
  transactionError = null;
  deleteAccessTokenService.mock.resetCalls();
  getShop.mock.resetCalls();
  transaction.mock.resetCalls();
  sessionDeleteMany.mock.resetCalls();
  store = { id: 7, shopUrl: SHOP, domain: "shop.example", apiKey: "key", orgId: 5 };
});

test("without a session: revokes the key, cleans up in one transaction, then deletes sessions", async () => {
  const response = await send();

  assert.equal(response.status, 200);
  assert.deepEqual(getShop.mock.calls[0].arguments, [SHOP]);
  assert.deepEqual(deleteAccessTokenService.mock.calls[0].arguments, [
    { apiKey: "key", domain: "shop.example", orgId: 5 },
  ]);
  assert.equal(transaction.mock.callCount(), 1);
  assert.deepEqual(transaction.mock.calls[0].arguments[0], [
    {
      op: "shop.update",
      args: {
        where: { id: 7 },
        data: {
          apiKey: null,
          apiKeyIv: null,
          apiKeyAuthTag: null,
          publicApiKey: null,
          active: false,
          isWebTrackingEnabled: false,
          isContactSyncEnabled: false,
          isOrderSyncEnabled: false,
          isProductVariantSyncEnabled: false,
          isMarketSyncEnabled: false,
          siteId: null,
          orgId: null,
          defaultLanguageCode: null,
          domain: SHOP,
        },
      },
    },
    ...SYNC_MODELS.map((model) => ({
      op: `${model}.deleteMany`,
      args: { where: { shopId: 7 } },
    })),
  ]);
  assert.deepEqual(sessionDeleteMany.mock.calls[0].arguments, [{ where: { shop: SHOP } }]);
  assert.deepEqual(calls, ["deleteAccessToken", "$transaction", "session.deleteMany"]);
});

test("a failed transaction propagates and keeps the sessions", async () => {
  transactionError = new Error("db down");

  await assert.rejects(send(), /db down/);
  assert.equal(sessionDeleteMany.mock.callCount(), 0);
});

test("an unknown shop only deletes its sessions", async () => {
  store = null;

  const response = await send();

  assert.equal(response.status, 200);
  assert.equal(transaction.mock.callCount(), 0);
  assert.equal(deleteAccessTokenService.mock.callCount(), 0);
  assert.deepEqual(sessionDeleteMany.mock.calls[0].arguments, [{ where: { shop: SHOP } }]);
});

test("a shop without an API key is cleaned up without calling Yespo", async () => {
  store = { ...store, apiKey: null };

  const response = await send();

  assert.equal(response.status, 200);
  assert.equal(deleteAccessTokenService.mock.callCount(), 0);
  assert.equal(transaction.mock.callCount(), 1);
  assert.equal(sessionDeleteMany.mock.callCount(), 1);
});
