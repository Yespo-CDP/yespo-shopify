import { shopMarketRepository } from "~/repositories/repositories.server";

import { shouldTrackMarketId } from "./market-tracking";

/**
 * Returns the market id to put on a backend tracking event.
 * Omits it when the stored visit has none, market sync is off, or the shop
 * no longer has more than one enabled market.
 */
export async function resolveTrackingMarketId(
  shop: { id: number; isMarketSyncEnabled?: boolean | null },
  storedMarketId: string | null | undefined,
): Promise<string | undefined> {
  if (!storedMarketId) return undefined;

  const markets = await shopMarketRepository.getByShopId(shop.id);
  const enabledMarketCount = markets.filter((market) => market.enabled).length;
  if (!shouldTrackMarketId(shop.isMarketSyncEnabled, enabledMarketCount)) {
    return undefined;
  }

  return storedMarketId;
}
