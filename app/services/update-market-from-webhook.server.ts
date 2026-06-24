import fs from "node:fs";
import path from "node:path";

import { marketSyncRepository, shopMarketRepository } from "~/repositories/repositories.server";
import type { MarketProductItem } from "~/api/update-market-products";
import { updateMarketProducts } from "~/api/update-market-products";
import { createClient } from "~/worker/services/create-client";
import { fetchShopMarketsConfig } from "~/worker/services/fetch-shop-markets-config";
import { getProductContextualPricing } from "~/worker/services/get-product-contextual-pricing";
import { computeContentHash } from "~/worker/services/compute-content-hash";
import { resolveMarketUrls } from "~/worker/services/resolve-market-urls";
import type { ShopMarketConfig } from "~/@types/shopMarketsConfig";

function writeDebug(name: string, data: unknown): void {
  try {
    const debugDir = path.resolve(process.cwd(), "debug");
    fs.mkdirSync(debugDir, { recursive: true });
    fs.writeFileSync(
      path.join(debugDir, `${name}-${Date.now()}.json`),
      JSON.stringify(data, null, 2),
    );
  } catch {
    // debug writes must never break the main flow
  }
}

function computeMarketHash(item: MarketProductItem): string {
  return computeContentHash({
    price: item.price,
    oldPrice: item.oldPrice ?? null,
    currency: item.currency,
    isInStock: item.isInStock,
    urls: item.urls ?? null,
  });
}

/**
 * Syncs market-specific prices, stock and URLs for a single product to Yespo
 * after a PRODUCTS_CREATE or PRODUCTS_UPDATE webhook.
 *
 * Flow:
 *  1. Fetch active markets config from Shopify.
 *  2. Fetch contextual pricing + publication state for all variants via GraphQL.
 *  3. Skip variants not published in a given market.
 *  4. Build market items and compute content hashes.
 *  5. Compare against stored MarketSync records — only send changed items.
 *  6. Call POST /v1/markets and update the MarketSync table.
 */
export async function updateMarketFromWebhook({
  shopId,
  shopifyDomain,
  accessToken,
  productGid,
  isMarketSyncEnabled,
  apiKey,
  siteId,
  domain,
  orgId,
}: {
  shopId: number;
  shopifyDomain: string;
  accessToken: string;
  productGid: string;
  isMarketSyncEnabled: boolean;
  apiKey: string;
  siteId: string;
  domain: string;
  orgId?: number | null;
}): Promise<void> {
  if (!isMarketSyncEnabled) return;

  const client = createClient({ shop: shopifyDomain, accessToken });

  const marketsConfig = await fetchShopMarketsConfig({ client });
  if (!marketsConfig.countries.length) return;

  const previousShopMarkets = await shopMarketRepository.getByShopId(shopId);
  const previousLocalesByMarketId = new Map(
    previousShopMarkets.map((market) => [market.marketId, market.locales]),
  );

  const pricing = await getProductContextualPricing({
    client,
    productGid,
    countries: marketsConfig.countries,
  });

  if (!pricing) return;

  const { handle, publishedInCountry, variants } = pricing;

  // Build countryCode → ShopMarketConfig lookup
  const countryToMarket = new Map<string, ShopMarketConfig>();
  for (const market of marketsConfig.markets) {
    for (const country of market.countries) {
      countryToMarket.set(country, market);
    }
  }

  const numericProductId = productGid.split("/").pop() ?? productGid;
  const currentCountrySet = new Set(marketsConfig.countries);

  // All country codes that have ever been synced for this shop.
  // Any code absent from the current Shopify markets is a removed market.
  const allSyncedCountries =
    await marketSyncRepository.getSyncedCountryCodes(shopId);
  const removedCountries = allSyncedCountries.filter(
    (cc) => !currentCountrySet.has(cc),
  );

  // For removed countries: find records belonging to this product, send
  // isInStock: 0 to Yespo and delete from DB.
  if (removedCountries.length > 0) {
    const orphanedRecords = await marketSyncRepository.getByKeys(
      shopId,
      variants.flatMap((v) =>
        removedCountries.map((cc) => ({
          productId: numericProductId,
          variantId: v.variantId,
          countryCode: cc,
        })),
      ),
    );

    if (orphanedRecords.length > 0) {
      const orphansByCountry = new Map<string, MarketProductItem[]>();
      const removedAt = new Date().toISOString();
      for (const record of orphanedRecords) {
        const numericVariantId =
          record.variantId.split("/").pop() ?? record.variantId;
        const item: MarketProductItem = {
          productId: numericVariantId,
          updatedDate: removedAt,
          isInStock: 0,
        };
        if (!orphansByCountry.has(record.countryCode)) {
          orphansByCountry.set(record.countryCode, []);
        }
        orphansByCountry.get(record.countryCode)!.push(item);
      }

      const orphanMarkets = Array.from(orphansByCountry.entries()).map(
        ([marketId, products]) => ({ marketId, products }),
      );
      writeDebug("market-removed-webhook", { siteId, markets: orphanMarkets });
      await updateMarketProducts({ apiKey, siteId, markets: orphanMarkets, domain, orgId });

      await marketSyncRepository.deleteManyByKeys(
        shopId,
        orphanedRecords.map((r) => ({
          productId: r.productId,
          variantId: r.variantId,
          countryCode: r.countryCode,
        })),
      );
    }
  }

  // Load existing MarketSync records for this product in current countries
  const existingRecords = await marketSyncRepository.getByKeys(
    shopId,
    variants.flatMap((v) =>
      marketsConfig.countries.map((cc) => ({
        productId: numericProductId,
        variantId: v.variantId,
        countryCode: cc,
      })),
    ),
  );

  const existingHashMap = new Map(
    existingRecords.map((r) => [
      `${r.variantId}:${r.countryCode}`,
      r.contentHash,
    ]),
  );

  // changed items to send + DB records to upsert
  const changedByCountry = new Map<string, MarketProductItem[]>();
  const upserts: Array<{
    productId: string;
    variantId: string;
    countryCode: string;
    contentHash: string;
  }> = [];

  for (const variant of variants) {
    const numericVariantId = variant.variantId.split("/").pop() ?? variant.variantId;

    for (const cc of marketsConfig.countries) {
      if (!publishedInCountry[cc]) continue;

      const countryPricing = variant.perCountry[cc];
      if (!countryPricing?.price?.amount || !countryPricing.price.currencyCode) {
        continue;
      }

      const price = parseFloat(countryPricing.price.amount);
      if (Number.isNaN(price)) continue;

      const isInStock: 0 | 1 =
        variant.inventoryQuantity == null || variant.inventoryQuantity > 0
          ? 1
          : 0;

      const item: MarketProductItem = {
        productId: numericVariantId,
        updatedDate: variant.updatedAt,
        price,
        currency: countryPricing.price.currencyCode,
        isInStock,
      };

      const compareAt = countryPricing.compareAtPrice?.amount
        ? parseFloat(countryPricing.compareAtPrice.amount)
        : 0;
      if (compareAt > price) {
        item.oldPrice = compareAt;
      }

      const market = countryToMarket.get(cc);
      const previousLocales = market
        ? (previousLocalesByMarketId.get(market.id) ?? [])
        : [];
      item.urls = resolveMarketUrls(market, handle, previousLocales);

      const newHash = computeMarketHash(item);
      const existingHash = existingHashMap.get(`${variant.variantId}:${cc}`);

      if (newHash === existingHash) continue;

      if (!changedByCountry.has(cc)) changedByCountry.set(cc, []);
      changedByCountry.get(cc)!.push(item);

      upserts.push({
        productId: numericProductId,
        variantId: variant.variantId,
        countryCode: cc,
        contentHash: newHash,
      });
    }
  }

  if (changedByCountry.size === 0) return;

  const markets = Array.from(changedByCountry.entries()).map(
    ([marketId, products]) => ({ marketId, products }),
  );

  writeDebug("market-update-webhook", { siteId, markets });
  await updateMarketProducts({ apiKey, siteId, markets, domain, orgId });

  await Promise.all(
    upserts.map((u) =>
      marketSyncRepository.createOrUpdate({
        productId: u.productId,
        variantId: u.variantId,
        countryCode: u.countryCode,
        contentHash: u.contentHash,
        shop: { connect: { id: shopId } },
      }),
    ),
  );
}
