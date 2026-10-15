import assert from "node:assert/strict";
import test from "node:test";

import {
  MarketCatalogSyncBusyError,
  reconcileMarketCatalogSync,
} from "./reconcile-market-catalog-sync";

function shop(overrides: {
  productSyncEnabled?: boolean;
  marketSyncEnabled?: boolean;
}) {
  return {
    isProductVariantSyncEnabled: overrides.productSyncEnabled ?? true,
    isMarketSyncEnabled: overrides.marketSyncEnabled ?? false,
  };
}

test("enables market sync and enqueues a full shop run when a second market appears", async () => {
  const calls: string[] = [];

  await reconcileMarketCatalogSync({
    shop: shop({ marketSyncEnabled: false }),
    enabledMarketCount: 2,
    updateMarketSyncEnabled: async (enabled) => {
      calls.push(`flag:${enabled}`);
    },
    enqueueMarketSync: async () => {
      calls.push("enqueue");
      return true;
    },
  });

  assert.deepEqual(calls, ["flag:true", "enqueue"]);
});

test("enqueues a full shop run for every enabled market when sync is already on", async () => {
  const calls: string[] = [];

  await reconcileMarketCatalogSync({
    shop: shop({ marketSyncEnabled: true }),
    enabledMarketCount: 3,
    updateMarketSyncEnabled: async (enabled) => {
      calls.push(`flag:${enabled}`);
    },
    enqueueMarketSync: async () => {
      calls.push("enqueue");
      return true;
    },
  });

  assert.deepEqual(calls, ["enqueue"]);
});

test("leaves a single-market shop alone", async () => {
  const calls: string[] = [];

  await reconcileMarketCatalogSync({
    shop: shop({ marketSyncEnabled: false }),
    enabledMarketCount: 1,
    updateMarketSyncEnabled: async (enabled) => {
      calls.push(`flag:${enabled}`);
    },
    enqueueMarketSync: async () => {
      calls.push("enqueue");
      return true;
    },
  });

  assert.deepEqual(calls, []);
});

test("does not start market sync while product sync is off", async () => {
  const calls: string[] = [];

  await reconcileMarketCatalogSync({
    shop: shop({ productSyncEnabled: false, marketSyncEnabled: false }),
    enabledMarketCount: 2,
    updateMarketSyncEnabled: async (enabled) => {
      calls.push(`flag:${enabled}`);
    },
    enqueueMarketSync: async () => {
      calls.push("enqueue");
      return true;
    },
  });

  assert.deepEqual(calls, []);
});

test("enqueues cleanup before turning market sync off", async () => {
  const calls: string[] = [];

  await reconcileMarketCatalogSync({
    shop: shop({ marketSyncEnabled: true }),
    enabledMarketCount: 1,
    updateMarketSyncEnabled: async (enabled) => {
      calls.push(`flag:${enabled}`);
    },
    enqueueMarketSync: async () => {
      calls.push("enqueue");
      return true;
    },
  });

  assert.deepEqual(calls, ["enqueue", "flag:false"]);
});

test("retries later when a run is already in progress", async () => {
  const calls: string[] = [];

  await assert.rejects(
    () =>
      reconcileMarketCatalogSync({
        shop: shop({ marketSyncEnabled: false }),
        enabledMarketCount: 2,
        updateMarketSyncEnabled: async (enabled) => {
          calls.push(`flag:${enabled}`);
        },
        enqueueMarketSync: async () => {
          calls.push("enqueue");
          return false;
        },
      }),
    MarketCatalogSyncBusyError,
  );

  assert.deepEqual(calls, ["flag:true", "enqueue"]);
});

test("keeps market sync enabled when cleanup cannot be queued yet", async () => {
  const calls: string[] = [];

  await assert.rejects(
    () =>
      reconcileMarketCatalogSync({
        shop: shop({ marketSyncEnabled: true }),
        enabledMarketCount: 1,
        updateMarketSyncEnabled: async (enabled) => {
          calls.push(`flag:${enabled}`);
        },
        enqueueMarketSync: async () => {
          calls.push("enqueue");
          return false;
        },
      }),
    MarketCatalogSyncBusyError,
  );

  assert.deepEqual(calls, ["enqueue"]);
});
