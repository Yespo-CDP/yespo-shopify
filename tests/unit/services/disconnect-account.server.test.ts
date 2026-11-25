import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const SYNC_MODELS = [
  "customerSync",
  "customerSyncLog",
  "orderSync",
  "orderSyncLog",
  "productVariantSync",
  "productVariantSyncLog",
  "marketSync",
  "marketSyncLog",
] as const;

const calls: { name: string; args: unknown }[] = [];
let shop: { id: number; shopId: string } | null = null;
let metafieldsError: Error | null = null;

mock.module("../../../app/repositories/repositories.server", {
  namedExports: {
    shopRepository: {
      updateShop: async (shopUrl: string, data: unknown) => {
        calls.push({ name: "updateShop", args: { shopUrl, data } });
      },
      getShop: async () => shop,
    },
  },
});
mock.module("../../../app/db.server", {
  defaultExport: Object.fromEntries(
    SYNC_MODELS.map((model) => [
      model,
      {
        deleteMany: async (args: unknown) => {
          calls.push({ name: `${model}.deleteMany`, args });
          return { count: 0 };
        },
      },
    ]),
  ),
});
mock.module("../../../app/shopify/mutations/delete-metafields.server", {
  defaultExport: async (args: unknown) => {
    calls.push({ name: "deleteMetafields", args });
    if (metafieldsError) throw metafieldsError;
  },
});

const { disconnectAccountService } = await import(
  "../../../app/services/disconnect-account.server"
);

const run = () =>
  disconnectAccountService({ session: { shop: "demo.myshopify.com" }, admin: {} });
const deleteCalls = () => calls.filter((c) => c.name.endsWith(".deleteMany"));

beforeEach(() => {
  calls.length = 0;
  shop = { id: 7, shopId: "gid://shopify/Shop/1" };
  metafieldsError = null;
});

test("clears every sync table and log of the shop by Shop.id", async () => {
  await run();

  assert.deepEqual(
    deleteCalls().map((c) => c.name).sort(),
    SYNC_MODELS.map((model) => `${model}.deleteMany`).sort(),
  );
  for (const call of deleteCalls()) {
    assert.deepEqual(call.args, { where: { shopId: 7 } });
  }
});

test("resets the stored product language, so the next account gets its own", async () => {
  await run();

  const { data } = calls.find((c) => c.name === "updateShop")?.args as {
    data: { defaultLanguageCode?: string | null };
  };
  assert.equal(data.defaultLanguageCode, null);
});

test("clears sync state only after the sync flags are turned off", async () => {
  await run();

  const updateIndex = calls.findIndex((c) => c.name === "updateShop");
  const firstDeleteIndex = calls.findIndex((c) =>
    c.name.endsWith(".deleteMany"),
  );
  assert.ok(updateIndex >= 0);
  assert.ok(firstDeleteIndex > updateIndex);
});

test("clears sync state even when deleting metafields fails", async () => {
  metafieldsError = new Error("metafields failed");

  await assert.rejects(run(), /metafields failed/);

  assert.equal(deleteCalls().length, SYNC_MODELS.length);
});

test("does not clear anything when the shop is not found", async () => {
  shop = null;

  await run();

  assert.equal(deleteCalls().length, 0);
  assert.equal(calls.some((c) => c.name === "deleteMetafields"), false);
});
