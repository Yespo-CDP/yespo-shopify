import type { ShopMarketConfig } from "~/@types/shopMarketsConfig";
import type { MarketRemovePatch } from "~/api/update-market-products";

/**
 * Market URLs split into values Yespo should store and locales it should clear.
 *
 * `clearUrls` is set only when the market has no locale to name. Named locales
 * without a storefront URL go to `urlsTranslations`.
 */
export interface ResolvedMarketUrls {
  urls?: Record<string, string>;
  urlsTranslations: string[];
  clearUrls: boolean;
}

/**
 * Builds the Yespo `urls` field for POST /v1/markets.
 *
 * `previousLocales` should come from the last persisted ShopMarket record so
 * locales removed from a market since the previous sync are still cleared.
 */
export function resolveMarketUrls(
  market: ShopMarketConfig | undefined,
  handle: string,
  previousLocales: string[] = [],
): ResolvedMarketUrls {
  const locales = [
    ...new Set([...(market?.locales ?? []), ...previousLocales]),
  ];

  if (locales.length === 0) {
    return { urlsTranslations: [], clearUrls: true };
  }

  const urls: Record<string, string> = {};
  const urlsTranslations: string[] = [];
  for (const locale of locales) {
    const rootUrl = market?.rootUrls?.[locale];
    if (handle && rootUrl) {
      urls[locale] = `${rootUrl.replace(/\/$/, "")}/products/${handle}`;
    } else {
      urlsTranslations.push(locale);
    }
  }

  if (Object.keys(urls).length === 0) {
    return { urlsTranslations, clearUrls: false };
  }

  return { urls, urlsTranslations, clearUrls: false };
}

/**
 * Puts a missing compare-at price and cleared market URLs into `remove`.
 * Numeric `oldPrice` and absolute URLs stay on the item. `null` is not sent.
 */
export function applyMarketClearing({
  price,
  compareAt,
  resolved,
}: {
  price: number;
  compareAt: number;
  resolved: ResolvedMarketUrls;
}): {
  oldPrice?: number;
  urls?: Record<string, string>;
  remove?: MarketRemovePatch;
} {
  const fields: Array<"oldPrice" | "urls"> = [];
  const patch: {
    oldPrice?: number;
    urls?: Record<string, string>;
    remove?: MarketRemovePatch;
  } = {};

  if (Number.isFinite(compareAt) && compareAt > price) {
    patch.oldPrice = compareAt;
  } else {
    fields.push("oldPrice");
  }

  if (resolved.urls) {
    patch.urls = resolved.urls;
  }
  if (resolved.clearUrls) {
    fields.push("urls");
  }

  const remove: MarketRemovePatch = {};
  if (fields.length > 0) remove.fields = fields;
  if (resolved.urlsTranslations.length > 0) {
    remove.urlsTranslations = resolved.urlsTranslations;
  }
  if (remove.fields || remove.urlsTranslations) {
    patch.remove = remove;
  }

  return patch;
}
