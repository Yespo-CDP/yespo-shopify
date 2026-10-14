const MARKET_ID_PATTERN = /^[a-z0-9._-]{1,128}$/;

/**
 * Number of storefront hosts in the web push multi-domain metafield.
 * The Admin API stores that metafield as a JSON object keyed by hostname.
 */
export function countStorefrontHosts(value: unknown): number {
  if (typeof value !== "string" || !value.trim()) return 0;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return 0;
    }
    return Object.keys(parsed).length;
  } catch {
    return 0;
  }
}

/**
 * Market id is sent when the multi-domain metafield lists more than one
 * storefront. A single host omits the field. Catalog market sync is separate.
 */
export function shouldTrackMarketId(storefrontHostCount: number): boolean {
  return storefrontHostCount > 1;
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
