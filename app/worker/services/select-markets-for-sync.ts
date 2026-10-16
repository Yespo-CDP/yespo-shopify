import type {
  ShopMarketConfig,
  ShopMarketsConfig,
} from "~/@types/shopMarketsConfig";

function marketIdsMatch(left: string, right: string): boolean {
  if (left === right) return true;
  const leftId = left.split("/").pop();
  const rightId = right.split("/").pop();
  return Boolean(leftId) && leftId === rightId;
}

/**
 * Keeps a single enabled market for a create-triggered catalog sync.
 * Returns null when that market is not in the enabled set (draft or gone).
 */
export function selectMarketsForSync(
  config: ShopMarketsConfig,
  marketId: string,
): ShopMarketsConfig | null {
  const market = config.markets.find((candidate: ShopMarketConfig) =>
    marketIdsMatch(candidate.id, marketId),
  );
  if (!market) return null;

  return {
    markets: [market],
    countries: [...new Set(market.countries)],
    locales: [...new Set(market.locales)],
  };
}
