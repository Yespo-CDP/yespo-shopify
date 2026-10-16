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

/** Enabled markets whose product list cannot be read from an attached catalog. */
export function marketsMissingActiveCatalog(
  markets: ShopMarketConfig[],
): ShopMarketConfig[] {
  return markets.filter((market) => market.catalogPublicationIds.length === 0);
}

/**
 * True when the product is published on at least one catalog attached to the
 * market. Several catalogs are a union. No catalog means not published.
 */
export function isPublishedOnMarketCatalog(
  publishedByPublicationId: Record<string, boolean>,
  catalogPublicationIds: string[],
): boolean {
  return catalogPublicationIds.some(
    (publicationId) => publishedByPublicationId[publicationId] === true,
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
