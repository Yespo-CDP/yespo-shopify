import { unauthenticated } from "~/shopify.server";
import {
  readContactMarketContext,
  readMarketId,
  resolveContactMarketId,
  type ContactMarketContext,
} from "~/services/market-tracking";

const MARKETS_PAGE_SIZE = 250;
const REGIONS_PAGE_SIZE = 250;

interface ContactMarketContextPage {
  backupRegion?: { code?: string | null } | null;
  markets?: {
    nodes?: Array<{
      enabled?: boolean | null;
      regions?: {
        nodes?: Array<{ code?: string | null } | null> | null;
      } | null;
    } | null> | null;
    pageInfo?: {
      hasNextPage?: boolean;
      endCursor?: string | null;
    };
  } | null;
}

/**
 * Loads enabled market countries and the shop backup region.
 * Returns null when Shopify cannot be read, so the caller keeps the
 * address country instead of guessing a fallback.
 */
export async function fetchContactMarketContext(
  shopUrl: string,
): Promise<ContactMarketContext | null> {
  if (!shopUrl) return null;

  try {
    const { admin } = await unauthenticated.admin(shopUrl);
    const countryCodes: string[] = [];
    let backupRegionCode: string | null = null;
    let cursor: string | null = null;
    let sawMarkets = false;

    do {
      const response = await admin.graphql(
        `#graphql
          query contactMarketContext($count: Int!, $regions: Int!, $cursor: String) {
            backupRegion {
              ... on MarketRegionCountry { code }
            }
            markets(first: $count, after: $cursor) {
              nodes {
                enabled
                regions(first: $regions) {
                  nodes {
                    ... on MarketRegionCountry { code }
                  }
                }
              }
              pageInfo { hasNextPage endCursor }
            }
          }
        `,
        {
          variables: {
            count: MARKETS_PAGE_SIZE,
            regions: REGIONS_PAGE_SIZE,
            cursor,
          },
        },
      );
      const parsed = (await response.json()) as {
        errors?: unknown[];
        data?: ContactMarketContextPage;
      };
      if (parsed.errors?.length || !parsed.data?.markets) {
        console.error(
          `Failed to read contact market context for ${shopUrl}:`,
          parsed.errors ?? "empty markets",
        );
        return null;
      }

      sawMarkets = true;
      const page = readContactMarketContext({
        backupRegion: parsed.data.backupRegion,
        markets: parsed.data.markets,
      });
      if (!page) return null;
      if (backupRegionCode === null) {
        backupRegionCode = page.backupRegionCode;
      }
      for (const code of page.marketCountryCodes) {
        if (!countryCodes.includes(code)) countryCodes.push(code);
      }

      cursor = parsed.data.markets.pageInfo?.hasNextPage
        ? (parsed.data.markets.pageInfo.endCursor ?? null)
        : null;
    } while (cursor);

    if (!sawMarkets) return null;
    return { marketCountryCodes: countryCodes, backupRegionCode };
  } catch (error) {
    console.error(
      `Failed to read contact market context for ${shopUrl}:`,
      error,
    );
    return null;
  }
}

/**
 * Market id for one contact. An update with no country skips Shopify and
 * leaves any Market ID already stored in Yespo untouched.
 */
export async function resolveShopContactMarketId({
  shopUrl,
  countryCode,
  whenCountryMissing,
}: {
  shopUrl: string;
  countryCode: unknown;
  whenCountryMissing: "backup" | "omit";
}): Promise<string | undefined> {
  if (whenCountryMissing === "omit" && !readMarketId(countryCode)) {
    return undefined;
  }

  const marketContext = await fetchContactMarketContext(shopUrl);
  return resolveContactMarketId({
    countryCode,
    marketContext,
    whenCountryMissing,
  });
}
