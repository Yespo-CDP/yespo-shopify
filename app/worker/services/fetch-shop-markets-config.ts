import type { GraphQLClient } from "@shopify/graphql-client";

import type {
  ShopMarketConfig,
  ShopMarketsConfig,
} from "~/@types/shopMarketsConfig";

interface MarketRegionCountry {
  code?: string;
}

interface MarketRootUrl {
  locale?: string;
  url?: string;
}

interface MarketNode {
  id: string;
  name: string;
  handle: string;
  enabled?: boolean;
  webPresence?: {
    defaultLocale?: { locale?: string };
    alternateLocales?: Array<{ locale?: string }>;
    rootUrls?: MarketRootUrl[];
  };
  regions?: {
    nodes?: MarketRegionCountry[];
  };
}

interface MarketsDetailedResponse {
  markets?: {
    nodes?: MarketNode[];
  };
}

function collectLocales(market: MarketNode): string[] {
  const locales = new Set<string>();
  const defaultLocale = market.webPresence?.defaultLocale?.locale;
  if (defaultLocale) {
    locales.add(defaultLocale);
  }

  for (const locale of market.webPresence?.alternateLocales ?? []) {
    if (locale.locale) {
      locales.add(locale.locale);
    }
  }

  return [...locales];
}

function collectRootUrls(market: MarketNode): Record<string, string> {
  const rootUrls: Record<string, string> = {};
  for (const entry of market.webPresence?.rootUrls ?? []) {
    if (entry.locale && entry.url) {
      rootUrls[entry.locale] = entry.url;
    }
  }
  return rootUrls;
}

function mapMarketNode(market: MarketNode): ShopMarketConfig {
  const countries = (market.regions?.nodes ?? [])
    .map((region) => region.code)
    .filter((code): code is string => Boolean(code));

  return {
    id: market.id,
    name: market.name,
    handle: market.handle,
    enabled: market.enabled ?? false,
    countries,
    locales: collectLocales(market),
    rootUrls: collectRootUrls(market),
  };
}

export async function fetchShopMarketsConfig({
  client,
}: {
  client: GraphQLClient;
}): Promise<ShopMarketsConfig> {
  const response = await client.request(
    `query getMarketsDetailed($count: Int) {
      markets(first: $count) {
        nodes {
          id
          name
          handle
          enabled
          webPresence {
            defaultLocale {
              locale
            }
            alternateLocales {
              locale
            }
            rootUrls {
              locale
              url
            }
          }
          regions(first: 50) {
            nodes {
              ... on MarketRegionCountry {
                code
              }
            }
          }
        }
      }
    }`,
    { variables: { count: 250 } },
  );

  const marketsData = response?.data as MarketsDetailedResponse;
  const markets = (marketsData?.markets?.nodes ?? [])
    .filter((market) => market.enabled)
    .map(mapMarketNode);
  console.log("markets", markets);
  const countries = [...new Set(markets.flatMap((market) => market.countries))];
  const locales = [...new Set(markets.flatMap((market) => market.locales))];

  return { markets, countries, locales };
}
