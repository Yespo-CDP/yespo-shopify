const MARKET_ID_PATTERN = /^[a-z0-9._-]{1,128}$/;

/**
 * A shop always has one primary market. Market catalog sync starts only when
 * another enabled market exists. Tracking events still send `marketId` for a
 * single market.
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

/**
 * Market id for a Yespo contact, taken from the customer's default address
 * country. Omitted when the country is missing, so an update does not clear
 * a Market ID already stored in Yespo.
 */
export function contactMarketId(countryCode: unknown): string | undefined {
  return readMarketId(countryCode) ?? undefined;
}
