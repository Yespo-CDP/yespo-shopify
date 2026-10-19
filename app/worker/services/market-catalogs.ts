import type { ShopMarketConfig } from "~/@types/shopMarketsConfig";

const CATALOG_PUBLICATION_ID = /^gid:\/\/shopify\/Publication\/\d+$/;

export interface MarketCatalogNode {
  status?: string | null;
  publication?: { id?: string | null } | null;
}

/**
 * Publication ids of catalogs that are active and can answer
 * `publishedOnPublication`. Draft, archived, and catalogs without a
 * publication do not count as attached.
 */
export function activeCatalogPublicationIds(
  catalogs: MarketCatalogNode[] | null | undefined,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const catalog of catalogs ?? []) {
    if (catalog.status?.toUpperCase() !== "ACTIVE") continue;
    const publicationId = catalog.publication?.id;
    if (!publicationId || !CATALOG_PUBLICATION_ID.test(publicationId)) {
      continue;
    }
    if (seen.has(publicationId)) continue;
    seen.add(publicationId);
    ids.push(publicationId);
  }

  return ids;
}

/**
 * True when the product is published on at least one catalog attached to the
 * market. Several catalogs are a union. An empty list is not a catalog match;
 * callers use `isProductInMarket` for markets that have no catalog.
 */
export function isPublishedOnMarketCatalog(
  publishedByPublicationId: Record<string, boolean>,
  catalogPublicationIds: string[],
): boolean {
  return catalogPublicationIds.some(
    (publicationId) => publishedByPublicationId[publicationId] === true,
  );
}

/** Active product published to the Online Store, the same set as the base catalog. */
export function isPublishedOnOnlineStore(
  status: string | null | undefined,
  publishedAt: string | null | undefined,
): boolean {
  return status?.toUpperCase() === "ACTIVE" && Boolean(publishedAt);
}

/**
 * A market with catalogs includes a product published on any of them.
 * A market with no catalog includes every active product published to the
 * Online Store. Its price still comes from contextual pricing for the country.
 */
export function isProductInMarket({
  catalogPublicationIds,
  publishedByPublicationId,
  status,
  publishedAt,
}: {
  catalogPublicationIds: string[];
  publishedByPublicationId: Record<string, boolean>;
  status?: string | null;
  publishedAt?: string | null;
}): boolean {
  if (catalogPublicationIds.length === 0) {
    return isPublishedOnOnlineStore(status, publishedAt);
  }
  return isPublishedOnMarketCatalog(
    publishedByPublicationId,
    catalogPublicationIds,
  );
}

/** True when one of these countries belongs to a market that has no catalog. */
export function countriesNeedOnlineStorePublication(
  markets: ShopMarketConfig[],
  countries: string[],
): boolean {
  const wanted = new Set(countries);
  return markets.some(
    (market) =>
      market.catalogPublicationIds.length === 0 &&
      market.countries.some((country) => wanted.has(country)),
  );
}

/** Catalog publications that apply to the given market countries. */
export function publicationIdsForCountries(
  markets: ShopMarketConfig[],
  countries: string[],
): string[] {
  const wanted = new Set(countries);
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const market of markets) {
    if (!market.countries.some((country) => wanted.has(country))) continue;
    for (const publicationId of market.catalogPublicationIds) {
      if (
        !CATALOG_PUBLICATION_ID.test(publicationId) ||
        seen.has(publicationId)
      ) {
        continue;
      }
      seen.add(publicationId);
      ids.push(publicationId);
    }
  }

  return ids;
}
