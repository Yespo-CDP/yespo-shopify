import type { GraphQLClient } from "@shopify/graphql-client";

import type {
  ShopMarketConfig,
  ShopMarketsConfig,
} from "~/@types/shopMarketsConfig";

import { activeCatalogPublicationIds } from "./market-catalogs";

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
    pageInfo?: { endCursor?: string | null; hasNextPage: boolean };
  };
  catalogs?: {
    nodes?: Array<{
      status?: string | null;
      publication?: { id?: string | null } | null;
    }>;
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
    catalogPublicationIds: activeCatalogPublicationIds(market.catalogs?.nodes),
  };
}

/**
 * Appends to `market.regions.nodes` the countries beyond the first page.
 * Throws on request errors so the market is not synced with part of its
 * countries.
 */
async function fetchRemainingRegions({
  client,
  market,
}: {
  client: GraphQLClient;
  market: MarketNode;
}): Promise<void> {
  let cursor = market.regions?.pageInfo?.hasNextPage
    ? market.regions.pageInfo.endCursor
    : null;

  while (cursor) {
    const response = await client.request(
      `query getMarketRegions($id: ID!, $cursor: String) {
        market(id: $id) {
          regions(first: 250, after: $cursor) {
            nodes {
              ... on MarketRegionCountry {
                code
              }
            }
            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }
      }`,
      { variables: { id: market.id, cursor } },
    );

    if (response.errors) {
      throw new Error(
        `Failed to fetch countries of market ${market.id}: ${JSON.stringify(response.errors)}`,
      );
    }

    const regions = (
      response.data as { market?: Pick<MarketNode, "regions"> | null }
    )?.market?.regions;
    market.regions?.nodes?.push(...(regions?.nodes ?? []));
    cursor = regions?.pageInfo?.hasNextPage ? regions.pageInfo.endCursor : null;
  }
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
            pageInfo {
              endCursor
              hasNextPage
            }
          }
          catalogs(first: 50) {
            nodes {
              status
              publication {
                id
              }
            }
          }
        }
      }
    }`,
    { variables: { count: 250 } },
  );

  if (response.errors) {
    throw new Error(
      `Failed to fetch markets: ${JSON.stringify(response.errors)}`,
    );
  }

  const marketsData = response?.data as MarketsDetailedResponse;
  const enabledNodes = (marketsData?.markets?.nodes ?? []).filter(
    (market) => market.enabled,
  );
  for (const market of enabledNodes) {
    await fetchRemainingRegions({ client, market });
  }
  const markets = enabledNodes.map(mapMarketNode);
  const countries = [...new Set(markets.flatMap((market) => market.countries))];
  const locales = [...new Set(markets.flatMap((market) => market.locales))];

  return { markets, countries, locales };
}
