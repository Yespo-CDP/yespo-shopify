import assert from "node:assert/strict";
import test from "node:test";

import { reconcileMarketCatalogSync } from "../../../app/services/reconcile-market-catalog-sync";

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
    },
  });

  assert.deepEqual(calls, ["flag:true", "enqueue"]);
});

test("keeps market sync on and enqueues a full shop run when one market remains", async () => {
  const calls: string[] = [];

  await reconcileMarketCatalogSync({
    shop: shop({ marketSyncEnabled: true }),
    enabledMarketCount: 1,
    updateMarketSyncEnabled: async (enabled) => {
      calls.push(`flag:${enabled}`);
    },
    enqueueMarketSync: async () => {
      calls.push("enqueue");
    },
  });

  assert.deepEqual(calls, ["enqueue"]);
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
    },
  });

  assert.deepEqual(calls, ["enqueue"]);
});

test("syncs only the updated market when market sync is already on", async () => {
  const calls: string[] = [];

  await reconcileMarketCatalogSync({
    shop: shop({ marketSyncEnabled: true }),
    enabledMarketCount: 3,
    marketId: "gid://shopify/Market/42859954414",
    updateMarketSyncEnabled: async (enabled) => {
      calls.push(`flag:${enabled}`);
    },
    enqueueMarketSync: async (scope) => {
      calls.push(scope?.marketId ? `enqueue:${scope.marketId}` : "enqueue");
    },
  });

  assert.deepEqual(calls, ["enqueue:gid://shopify/Market/42859954414"]);
});

test("syncs only the created market when market sync is already on", async () => {
  const calls: string[] = [];

  await reconcileMarketCatalogSync({
    shop: shop({ marketSyncEnabled: true }),
    enabledMarketCount: 3,
    marketId: "gid://shopify/Market/188558248",
    updateMarketSyncEnabled: async (enabled) => {
      calls.push(`flag:${enabled}`);
    },
    enqueueMarketSync: async (scope) => {
      calls.push(scope?.marketId ? `enqueue:${scope.marketId}` : "enqueue");
    },
  });

  assert.deepEqual(calls, ["enqueue:gid://shopify/Market/188558248"]);
});

test("full-syncs every market when the second market turns sync on", async () => {
  const calls: string[] = [];

  await reconcileMarketCatalogSync({
    shop: shop({ marketSyncEnabled: false }),
    enabledMarketCount: 2,
    marketId: "gid://shopify/Market/188558248",
    updateMarketSyncEnabled: async (enabled) => {
      calls.push(`flag:${enabled}`);
    },
    enqueueMarketSync: async (scope) => {
      calls.push(scope?.marketId ? `enqueue:${scope.marketId}` : "enqueue");
    },
  });

  assert.deepEqual(calls, ["flag:true", "enqueue"]);
});

test("enables market sync and enqueues a full shop run for a single market", async () => {
  const calls: string[] = [];

  await reconcileMarketCatalogSync({
    shop: shop({ marketSyncEnabled: false }),
    enabledMarketCount: 1,
    updateMarketSyncEnabled: async (enabled) => {
      calls.push(`flag:${enabled}`);
    },
    enqueueMarketSync: async () => {
      calls.push("enqueue");
    },
  });

  assert.deepEqual(calls, ["flag:true", "enqueue"]);
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
    },
  });

  assert.deepEqual(calls, []);
});

test("enqueues cleanup before turning market sync off", async () => {
  const calls: string[] = [];

  await reconcileMarketCatalogSync({
    shop: shop({ marketSyncEnabled: true }),
    enabledMarketCount: 0,
    updateMarketSyncEnabled: async (enabled) => {
      calls.push(`flag:${enabled}`);
    },
    enqueueMarketSync: async () => {
      calls.push("enqueue");
    },
  });

  assert.deepEqual(calls, ["enqueue", "flag:false"]);
});

test("keeps market sync enabled when cleanup cannot be queued", async () => {
  const calls: string[] = [];

  await assert.rejects(
    () =>
      reconcileMarketCatalogSync({
        shop: shop({ marketSyncEnabled: true }),
        enabledMarketCount: 0,
        updateMarketSyncEnabled: async (enabled) => {
          calls.push(`flag:${enabled}`);
        },
        enqueueMarketSync: async () => {
          calls.push("enqueue");
          throw new Error("redis down");
        },
      }),
    /redis down/,
  );

  assert.deepEqual(calls, ["enqueue"]);
});

for (const [label, marketSyncEnabled, expected] of [
  ["turning sync on", false, ["flag:true", "enqueue"]],
  ["syncing one market", true, ["enqueue"]],
] as const) {
  test(`${label}: an error while queuing the job is passed to the caller`, async () => {
    const calls: string[] = [];

    await assert.rejects(
      () =>
        reconcileMarketCatalogSync({
          shop: shop({ marketSyncEnabled }),
          enabledMarketCount: 2,
          marketId: "gid://shopify/Market/188558248",
          updateMarketSyncEnabled: async (enabled) => {
            calls.push(`flag:${enabled}`);
          },
          enqueueMarketSync: async () => {
            calls.push("enqueue");
            throw new Error("redis down");
          },
        }),
      /redis down/,
    );

    assert.deepEqual(calls, expected);
  });
}
