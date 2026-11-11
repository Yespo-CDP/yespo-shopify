const MARKET_ID_PATTERN = /^[a-z0-9._-]{1,128}$/;

/**
 * Market catalog sync runs whenever the shop has an enabled market, including
 * a shop whose only market is the primary one. Tracking events also send
 * `marketId` in that case. Zero enabled markets turns catalog sync off.
 */
export function shouldEnableMarketSync(enabledMarketCount: number): boolean {
  return enabledMarketCount >= 1;
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

export interface ContactMarketContext {
  marketCountryCodes: string[];
  backupRegionCode: string | null;
}

/**
 * Chooses the market id to send for a contact.
 *
 * An address country is kept when it belongs to an enabled shop market.
 * Any other country is replaced with the shop backup region. A missing
 * country uses that backup region only while the contact is being created.
 * On update it is omitted, so a Market ID already stored in Yespo stays.
 * When the shop markets could not be loaded, the address country is sent
 * as-is and a missing country is omitted.
 */
export function resolveContactMarketId({
  countryCode,
  marketContext,
  whenCountryMissing,
}: {
  countryCode: unknown;
  marketContext: ContactMarketContext | null;
  whenCountryMissing: "backup" | "omit";
}): string | undefined {
  const country = readMarketId(countryCode);
  if (!marketContext) {
    return country ?? undefined;
  }

  const backup = readMarketId(marketContext.backupRegionCode);
  const markets = new Set(marketContext.marketCountryCodes);
  if (country && markets.has(country)) {
    return country;
  }
  if (country || whenCountryMissing === "backup") {
    return backup ?? undefined;
  }
  return undefined;
}

interface MarketContextRegion {
  code?: string | null;
}

interface MarketContextNode {
  enabled?: boolean | null;
  regions?: {
    nodes?: Array<MarketContextRegion | null> | null;
  } | null;
}

/**
 * Enabled market countries plus the shop backup region from the Admin API.
 * Returns null when the markets list itself is missing.
 */
export function readContactMarketContext(
  data:
    | {
        backupRegion?: { code?: string | null } | null;
        markets?: { nodes?: Array<MarketContextNode | null> | null } | null;
      }
    | null
    | undefined,
): ContactMarketContext | null {
  if (!data?.markets) return null;

  const marketCountryCodes: string[] = [];
  for (const market of data.markets.nodes ?? []) {
    if (!market?.enabled) continue;
    for (const region of market.regions?.nodes ?? []) {
      const code = readMarketId(region?.code);
      if (code && !marketCountryCodes.includes(code)) {
        marketCountryCodes.push(code);
      }
    }
  }

  return {
    marketCountryCodes,
    backupRegionCode: readMarketId(data.backupRegion?.code),
  };
}
