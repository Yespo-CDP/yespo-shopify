const MARKET_ID_PATTERN = /^[a-z0-9._-]{1,128}$/;

/**
 * Market id is sent only when catalog sync by markets is on and the shop has
 * more than one enabled market. A single market omits the field.
 */
export function shouldTrackMarketId(
  isMarketSyncEnabled: boolean | null | undefined,
  enabledMarketCount: number,
): boolean {
  return Boolean(isMarketSyncEnabled) && enabledMarketCount > 1;
}

/**
 * A shop always has one primary market. Market catalog sync starts only when
 * another enabled market exists.
 */
export function shouldEnableMarketSync(enabledMarketCount: number): boolean {
  return enabledMarketCount > 1;
}

/**
 * Accepts the same market id shape Yespo stores: lowercase letters, digits,
 * `.`, `_`, and `-`, at most 128 characters. Anything else is dropped.
 */
export function readMarketId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const marketId = value.trim().toLowerCase();
  if (!MARKET_ID_PATTERN.test(marketId)) return null;
  return marketId;
}
