import {
  marketSyncLogRepository,
  marketSyncRepository,
  shopMarketRepository,
  shopRepository,
  tmpMarketSyncRepository,
} from "~/repositories/repositories.server";
import type { ShopMarketsConfig } from "~/@types/shopMarketsConfig";
import type { TmpMarketSyncRecord } from "~/@types/tmpMarketSync";
import {
  updateMarketProducts,
  type MarketProductItem,
} from "~/api/update-market-products";

import {
  runBulkQuery,
  waitForBulkOperation,
} from "../services/bulk-operation.server";
import { computeContentHash } from "../services/compute-content-hash";
import { createClient } from "../services/create-client";
import { fetchShopMarketsConfig } from "../services/fetch-shop-markets-config";
import { streamBulkJsonlToTmpMarketSync } from "../services/parse-bulk-jsonl";
import { buildBulkQueryChunks } from "../services/product-sync-bulk-queries";

const API_CHUNK_SIZE = 500;

interface CountryStats {
  synced: number;
  skipped: number;
  failed: number;
  total: number;
}

interface PricingPayload {
  type: "pricing";
  variantUpdatedAt?: string;
  inventoryQuantity?: number | null;
  pricing?: {
    price?: { amount?: string; currencyCode?: string } | null;
    compareAtPrice?: { amount?: string; currencyCode?: string } | null;
  } | null;
  urls?: Record<string, string | null> | null;
}

function createEmptyCountryStats(): CountryStats {
  return { synced: 0, skipped: 0, failed: 0, total: 0 };
}

function initCountryStats(countries: string[]): Record<string, CountryStats> {
  return Object.fromEntries(
    countries.map((countryCode) => [countryCode, createEmptyCountryStats()]),
  );
}

/**
 * Maps a staged pricing row to a Yespo market product item.
 *
 * Products that are not published in the market never reach the staging table,
 * so `isInStock` here reflects inventory only. Returns `null` when there is no
 * market price to send (a market record needs price + currency + isInStock).
 */
function buildMarketProductItem(
  row: TmpMarketSyncRecord,
): MarketProductItem | null {
  const payload = row.payload as unknown as PricingPayload;
  const price = payload.pricing?.price;
  if (!price?.amount || !price.currencyCode) {
    return null;
  }

  const priceValue = parseFloat(price.amount);
  if (Number.isNaN(priceValue)) {
    return null;
  }

  const inventoryQuantity = payload.inventoryQuantity;
  const isInStock: 0 | 1 =
    inventoryQuantity == null || inventoryQuantity > 0 ? 1 : 0;

  const variantId = row.variantId as string;
  const productId = variantId.split("/").pop() ?? variantId;

  const item: MarketProductItem = {
    productId,
    updatedDate: payload.variantUpdatedAt ?? new Date().toISOString(),
    price: priceValue,
    currency: price.currencyCode,
    isInStock,
  };

  const compareAt = payload.pricing?.compareAtPrice?.amount
    ? parseFloat(payload.pricing.compareAtPrice.amount)
    : 0;
  // Always set oldPrice explicitly: a value when valid, null otherwise.
  // Omitting the field would tell Yespo to preserve the previous value, so we
  // must pass null to clear a compareAtPrice that was removed on Shopify.
  item.oldPrice = compareAt > priceValue ? compareAt : null;

  // Always set urls explicitly (null clears all; per-locale null clears one locale).
  item.urls = payload.urls ?? null;

  return item;
}

function hashMarketItem(item: MarketProductItem): string {
  return computeContentHash({
    price: item.price,
    oldPrice: item.oldPrice ?? null,
    currency: item.currency,
    isInStock: item.isInStock,
    urls: item.urls ?? null,
  });
}

/**
 * Syncs market-specific prices, stock, and URLs from Shopify to the Yespo
 * POST /v1/markets API.
 *
 * Flow: fetch markets config → run Shopify Bulk Operation(s) for per-country
 * contextual pricing → stream the JSONL result into TmpMarketSync → map staged
 * rows to market items, skip unchanged ones via the MarketSync content hash, and
 * send them grouped by market (marketId = country code).
 */
export const marketSyncHandler = async (
  shop: string,
  accessToken: string,
  apiKey: string,
  shopId: number,
  orgId?: number | null,
  siteId?: string | null,
) => {
  console.log(`⏳ Market sync start for ${shop}`);

  const shopData = await shopRepository.getShop(shop);
  if (!shopData?.isMarketSyncEnabled) {
    console.log(`⚠️ Market sync disabled for ${shop}`);
    return;
  }

  const client = createClient({ shop, accessToken });
  let marketsConfig: ShopMarketsConfig = {
    markets: [],
    countries: [],
    locales: [],
  };
  const stats = initCountryStats([]);

  const writeLog = async (
    countryCode: string,
    status: "IN_PROGRESS" | "COMPLETE" | "ERROR",
    bulkBatchId?: string,
  ) => {
    const countryStats = stats[countryCode] ?? createEmptyCountryStats();
    await marketSyncLogRepository.createOrUpdate({
      countryCode,
      status,
      bulkBatchId,
      syncedCount: countryStats.synced,
      skippedCount: countryStats.skipped,
      failedCount: countryStats.failed,
      totalCount: countryStats.total,
      shop: { connect: { id: shopId } },
    });
  };

  try {
    marketsConfig = await fetchShopMarketsConfig({ client });

    // Markets removed/disabled in Shopify: drop their products from Yespo
    // recommendations (isInStock: 0) and prune local state. Runs even when no
    // markets remain, so a fully removed market set is still cleaned up.
    await cleanupRemovedMarkets({
      shopId,
      apiKey,
      shop,
      orgId,
      siteId,
      currentCountries: marketsConfig.countries,
    });

    const previousShopMarkets = await shopMarketRepository.getByShopId(shopId);
    const previousLocalesByMarketId = new Map(
      previousShopMarkets.map((market) => [market.marketId, market.locales]),
    );

    await shopMarketRepository.replaceAll(shopId, marketsConfig.markets);

    if (marketsConfig.countries.length === 0) {
      console.log(`⚠️ No enabled market countries for ${shop}`);
      return;
    }

    Object.assign(stats, initCountryStats(marketsConfig.countries));
    for (const countryCode of marketsConfig.countries) {
      await writeLog(countryCode, "IN_PROGRESS");
    }

    const queryChunks = buildBulkQueryChunks(marketsConfig);

    for (const chunk of queryChunks) {
      const batchId = await runBulkQuery({ client, query: chunk.query });
      for (const countryCode of chunk.countries) {
        await writeLog(countryCode, "IN_PROGRESS", batchId);
      }

      const bulkResult = await waitForBulkOperation({ client });

      const outputPath = await streamBulkJsonlToTmpMarketSync({
        url: bulkResult.url,
        shop,
        batchId,
        shopId,
        config: marketsConfig,
        countries: chunk.countries,
        previousLocalesByMarketId,
      });
      console.log(`Bulk JSONL saved to ${outputPath}`);

      await processBatch({
        shopId,
        batchId,
        apiKey,
        shop,
        orgId,
        siteId,
        countries: chunk.countries,
        stats,
      });

      for (const countryCode of chunk.countries) {
        await writeLog(countryCode, "IN_PROGRESS", batchId);
      }

      await tmpMarketSyncRepository.deleteByBatch(shopId, batchId);
    }

    for (const countryCode of marketsConfig.countries) {
      await writeLog(countryCode, "COMPLETE");
    }

    console.log(`✅ Market sync finish for ${shop}`);
  } catch (error: unknown) {
    console.error("Market sync error", error);
    for (const countryCode of marketsConfig.countries) {
      await writeLog(countryCode, "ERROR");
    }
  }
};

/**
 * Maps staged pricing rows for one bulk batch, skips unchanged items, and sends
 * the rest to Yespo grouped by market (country). Mutates `stats` in place.
 */
async function processBatch({
  shopId,
  batchId,
  apiKey,
  shop,
  orgId,
  siteId,
  countries,
  stats,
}: {
  shopId: number;
  batchId: string;
  apiKey: string;
  shop: string;
  orgId?: number | null;
  siteId?: string | null;
  countries: string[];
  stats: Record<string, CountryStats>;
}): Promise<void> {
  const rows = await tmpMarketSyncRepository.getByBatch(shopId, batchId);
  const pricingRows = rows.filter((row) => row.countryCode && row.variantId);

  interface PendingItem {
    productId: string;
    variantId: string;
    countryCode: string;
    item: MarketProductItem;
    hash: string;
  }
  const pending: PendingItem[] = [];

  for (const row of pricingRows) {
    const countryCode = row.countryCode as string;
    if (!stats[countryCode]) {
      continue;
    }

    const item = buildMarketProductItem(row);
    if (!item) {
      continue;
    }

    stats[countryCode].total += 1;
    pending.push({
      productId: row.productId,
      variantId: row.variantId as string,
      countryCode,
      item,
      hash: hashMarketItem(item),
    });
  }

  // Change detection: load existing sync state for this batch in one query.
  const existing = await marketSyncRepository.getByKeys(
    shopId,
    pending.map((entry) => ({
      productId: entry.productId,
      variantId: entry.variantId,
      countryCode: entry.countryCode,
    })),
  );
  const existingMap = new Map(
    existing.map((existingRow) => [
      `${existingRow.productId}|${existingRow.variantId}|${existingRow.countryCode}`,
      existingRow,
    ]),
  );

  const toSyncByCountry: Record<string, PendingItem[]> = {};
  for (const entry of pending) {
    const previous = existingMap.get(
      `${entry.productId}|${entry.variantId}|${entry.countryCode}`,
    );
    const entityUpdatedAt = new Date(entry.item.updatedDate).getTime();
    const syncUpdatedAt = previous?.updatedAt?.getTime() ?? 0;

    if (
      previous?.contentHash === entry.hash &&
      entityUpdatedAt <= syncUpdatedAt
    ) {
      stats[entry.countryCode].skipped += 1;
      continue;
    }

    (toSyncByCountry[entry.countryCode] ??= []).push(entry);
  }

  for (const countryCode of countries) {
    const entries = toSyncByCountry[countryCode] ?? [];

    for (let index = 0; index < entries.length; index += API_CHUNK_SIZE) {
      const chunk = entries.slice(index, index + API_CHUNK_SIZE);

      const response = await updateMarketProducts({
        apiKey,
        siteId: siteId ?? "",
        markets: [
          { marketId: countryCode, products: chunk.map((c) => c.item) },
        ],
        domain: shop,
        orgId,
      });

      for (const entry of chunk) {
        if (response.failedItems.includes(entry.item.productId)) {
          stats[countryCode].failed += 1;
          continue;
        }

        stats[countryCode].synced += 1;
        await marketSyncRepository.createOrUpdate({
          productId: entry.productId,
          variantId: entry.variantId,
          countryCode,
          contentHash: entry.hash,
          updatedAt: new Date(entry.item.updatedDate),
          shop: { connect: { id: shopId } },
        });
      }
    }
  }
}

/**
 * Handles markets that were removed or disabled in Shopify since the last sync.
 *
 * For every country we previously synced but that is no longer present, sends
 * `isInStock: 0` to Yespo (the documented way to drop products from a market's
 * recommendations — there is no market-level delete) and removes the local
 * MarketSync / MarketSyncLog rows for that country.
 */
async function cleanupRemovedMarkets({
  shopId,
  apiKey,
  shop,
  orgId,
  siteId,
  currentCountries,
}: {
  shopId: number;
  apiKey: string;
  shop: string;
  orgId?: number | null;
  siteId?: string | null;
  currentCountries: string[];
}): Promise<void> {
  const syncedCountries =
    await marketSyncRepository.getSyncedCountryCodes(shopId);
  const removedCountries = syncedCountries.filter(
    (countryCode) => !currentCountries.includes(countryCode),
  );

  if (removedCountries.length === 0) {
    return;
  }

  console.log(
    `🗑️ Removing ${removedCountries.length} market(s) from Yespo for ${shop}: ${removedCountries.join(", ")}`,
  );

  for (const countryCode of removedCountries) {
    const rows = await marketSyncRepository.getByCountry(shopId, countryCode);

    const items: MarketProductItem[] = rows.map((row) => ({
      productId: row.variantId.split("/").pop() ?? row.variantId,
      updatedDate: new Date().toISOString(),
      isInStock: 0,
    }));

    const allFailedItems: string[] = [];

    for (let index = 0; index < items.length; index += API_CHUNK_SIZE) {
      const chunk = items.slice(index, index + API_CHUNK_SIZE);
      const response = await updateMarketProducts({
        apiKey,
        siteId: siteId ?? "",
        markets: [{ marketId: countryCode, products: chunk }],
        domain: shop,
        orgId,
      });
      allFailedItems.push(...response.failedItems);
    }

    if (allFailedItems.length > 0) {
      console.warn(
        `⚠️ ${allFailedItems.length} item(s) failed cleanup for market ${countryCode}, skipping local record deletion`,
      );
      // FIX ME:  додати логер від Yespo (передати кількість варіантів), кастомний евент CUSTOM_LOG_MARKET_SYNC_CLEANUP_FAILED
      continue;
    }
    // FIXME: якщо успішно також передавати логи
    await marketSyncRepository.deleteByCountry(shopId, countryCode);
    await marketSyncLogRepository.deleteByCountry(shopId, countryCode);
  }
}
