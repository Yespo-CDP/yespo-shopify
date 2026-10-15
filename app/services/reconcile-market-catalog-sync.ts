import { shouldEnableMarketSync } from "./market-tracking";

/**
 * Thrown when a shop-wide market sync should run but a fresh run is already
 * in progress. Callers answer with HTTP 500 so Shopify retries the webhook
 * after the current run finishes.
 */
export class MarketCatalogSyncBusyError extends Error {
  constructor() {
    super("Market catalog sync is already in progress");
    this.name = "MarketCatalogSyncBusyError";
  }
}

/**
 * Starts or stops shop-wide market catalog sync after a markets webhook.
 *
 * The queued job syncs every enabled market, including one that was just
 * added or turned on. Unchanged countries are skipped later by content hash.
 *
 * Turning sync off queues that same job first, while the flag is still on,
 * so removed countries are cleared. The flag flips only after the job is queued.
 */
export async function reconcileMarketCatalogSync({
  shop,
  enabledMarketCount,
  updateMarketSyncEnabled,
  enqueueMarketSync,
}: {
  shop: {
    isProductVariantSyncEnabled: boolean;
    isMarketSyncEnabled: boolean;
  };
  enabledMarketCount: number;
  updateMarketSyncEnabled: (enabled: boolean) => Promise<void>;
  enqueueMarketSync: () => Promise<boolean>;
}): Promise<void> {
  if (!shop.isProductVariantSyncEnabled) {
    return;
  }

  const enable = shouldEnableMarketSync(enabledMarketCount);

  if (enable) {
    if (!shop.isMarketSyncEnabled) {
      await updateMarketSyncEnabled(true);
    }
    if (!(await enqueueMarketSync())) {
      throw new MarketCatalogSyncBusyError();
    }
    return;
  }

  if (!shop.isMarketSyncEnabled) {
    return;
  }

  if (!(await enqueueMarketSync())) {
    throw new MarketCatalogSyncBusyError();
  }
  await updateMarketSyncEnabled(false);
}
