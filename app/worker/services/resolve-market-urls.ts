import type { ShopMarketConfig } from "~/@types/shopMarketsConfig";

/**
 * Builds the Yespo `urls` field for POST /v1/markets.
 *
 * Always returns an explicit value (`null` or a locale map) so callers never
 * rely on omit semantics, which would preserve stale URLs in Yespo.
 *
 * - All locales cleared → `null`
 * - Some locales cleared → `{ "en": "https://...", "fr": null }`
 *
 * `previousLocales` should come from the last persisted ShopMarket record so
 * locales removed from a market since the previous sync are still nulled out.
 */
export function resolveMarketUrls(
  market: ShopMarketConfig | undefined,
  handle: string,
  previousLocales: string[] = [],
): Record<string, string | null> | null {
  const locales = new Set([
    ...(market?.locales ?? []),
    ...previousLocales,
  ]);

  if (locales.size === 0) {
    return null;
  }

  const urls: Record<string, string | null> = {};
  for (const locale of locales) {
    const rootUrl = market?.rootUrls?.[locale];
    if (handle && rootUrl) {
      urls[locale] = `${rootUrl.replace(/\/$/, "")}/${handle}`;
    } else {
      urls[locale] = null;
    }
  }

  const hasAnyUrl = Object.values(urls).some((value) => value !== null);
  if (!hasAnyUrl) {
    return null;
  }

  return urls;
}
