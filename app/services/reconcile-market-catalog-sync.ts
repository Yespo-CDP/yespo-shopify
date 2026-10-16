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
 * Starts or stops market catalog sync after a markets webhook.
 *
 * The first time a shop has more than one enabled market, the queued job
 * syncs every enabled market. The primary market has never been sent to Yespo.
 *
 * A later `markets/create` passes `addedMarketId` and the job syncs only that
 * market. Updates and the daily cron still sync the whole shop.
 *
 * Turning sync off queues a full job first, while the flag is still on,
 * so removed countries are cleared. The flag flips only after the job is queued.
 */
export async function reconcileMarketCatalogSync({
  shop,
  enabledMarketCount,
  addedMarketId,
  updateMarketSyncEnabled,
  enqueueMarketSync,
}: {
  shop: {
    isProductVariantSyncEnabled: boolean;
    isMarketSyncEnabled: boolean;
  };
  enabledMarketCount: number;
  /** Set on markets/create when sync is already on. */
  addedMarketId?: string | null;
  updateMarketSyncEnabled: (enabled: boolean) => Promise<void>;
  enqueueMarketSync: (scope?: { marketId: string }) => Promise<boolean>;
}): Promise<void> {
  if (!shop.isProductVariantSyncEnabled) {
    return;
  }

  const enable = shouldEnableMarketSync(enabledMarketCount);

  if (enable) {
    if (!shop.isMarketSyncEnabled) {
      await updateMarketSyncEnabled(true);
      if (!(await enqueueMarketSync())) {
        throw new MarketCatalogSyncBusyError();
      }
      return;
    }

    if (
      !(await enqueueMarketSync(
        addedMarketId ? { marketId: addedMarketId } : undefined,
      ))
    ) {
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
