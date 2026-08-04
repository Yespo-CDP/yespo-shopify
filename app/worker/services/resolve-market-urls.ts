import type { ShopMarketConfig } from "~/@types/shopMarketsConfig";

import { appendVariantParam } from "./append-variant-param";
import { appendResolvedUrlDebug } from "./debug-market-urls.server";

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
  variantId?: string,
): Record<string, string | null> | null {
  const result = computeMarketUrls(market, handle, previousLocales, variantId);

  appendResolvedUrlDebug({
    marketId: market?.id,
    marketHandle: market?.handle,
    productHandle: handle,
    inputRootUrls: market?.rootUrls,
    result,
  });

  return result;
}

function computeMarketUrls(
  market: ShopMarketConfig | undefined,
  handle: string,
  previousLocales: string[] = [],
  variantId?: string,
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
      // Shopify storefront product pages live under `/products/{handle}`; the
      // locale subfolder (if any) is already baked into the market root URL.
      // A `?variant=<id>` query selects the exact variant (each market item is a
      // single variant, so productId === the numeric variant id).
      const base = `${rootUrl.replace(/\/$/, "")}/products/${handle}`;
      urls[locale] = appendVariantParam(base, variantId);
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
