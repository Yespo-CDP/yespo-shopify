import { shouldEnableMarketSync } from "./market-tracking";

/**
 * Starts or stops market catalog sync after a markets webhook.
 *
 * The first time a shop has at least one enabled market, the queued job
 * syncs every enabled market.
 *
 * A later `markets/create` or `markets/update` passes `marketId` and the job
 * syncs only that market. The daily cron still syncs the whole shop.
 *
 * Turning sync off (no enabled markets left) queues a full job first, while
 * the flag is still on, so removed countries are cleared. The flag flips
 * only after the job is queued: `enqueueMarketSync` throws when it is not.
 */
export async function reconcileMarketCatalogSync({
  shop,
  enabledMarketCount,
  marketId,
  updateMarketSyncEnabled,
  enqueueMarketSync,
}: {
  shop: {
    isProductVariantSyncEnabled: boolean;
    isMarketSyncEnabled: boolean;
  };
  enabledMarketCount: number;
  /**
   * Set on markets/create and markets/update when sync is already on.
   * Omit it for a shop-wide run (first enable, delete, daily cron).
   */
  marketId?: string | null;
  updateMarketSyncEnabled: (enabled: boolean) => Promise<void>;
  enqueueMarketSync: (scope?: { marketId: string }) => Promise<void>;
}): Promise<void> {
  if (!shop.isProductVariantSyncEnabled) {
    return;
  }

  const enable = shouldEnableMarketSync(enabledMarketCount);

  if (enable) {
    if (!shop.isMarketSyncEnabled) {
      await updateMarketSyncEnabled(true);
      await enqueueMarketSync();
      return;
    }

    await enqueueMarketSync(marketId ? { marketId } : undefined);
    return;
  }

  if (!shop.isMarketSyncEnabled) {
    return;
  }

  await enqueueMarketSync();
  await updateMarketSyncEnabled(false);
}
