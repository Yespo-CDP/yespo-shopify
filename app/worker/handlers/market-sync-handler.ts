import {
  marketSyncLogRepository,
  marketSyncRepository,
  shopMarketRepository,
  shopRepository,
  tmpMarketSyncRepository,
} from "~/repositories/repositories.server";
import type { MarketSyncRecord } from "~/@types/marketSync";
import type { ShopMarketsConfig } from "~/@types/shopMarketsConfig";
import type { TmpMarketSyncRecord } from "~/@types/tmpMarketSync";
import {
  updateMarketProducts,
  type MarketProductItem,
} from "~/api/update-market-products";
import { sendLogEvent } from "~/api/send-log-event";
import { EVENT_MESSAGES } from "~/config/constants";
import {
  runBulkQuery,
  waitForBulkOperation,
} from "../services/bulk-operation.server";
import { computeContentHash } from "../services/compute-content-hash";
import { createClient } from "../services/create-client";
import { fetchShopMarketsConfig } from "../services/fetch-shop-markets-config";
import { selectMarketsForSync } from "../services/select-markets-for-sync";
import { streamBulkJsonlToTmpMarketSync } from "../services/parse-bulk-jsonl";
import { buildBulkQueryChunks } from "../services/product-sync-bulk-queries";
import {
  marketSyncRowsRemovedFromCatalog,
  variantIdsPresentInCountry,
} from "../services/catalog-removed-variants";

const API_CHUNK_SIZE = 500;

// One lookup of every variant × country can exceed Postgres/Prisma limits
// (about 2,000 variants × 3 countries). Read the existing rows in pages.
const EXISTING_SYNC_LOOKUP_CHUNK = 500;

// Cleanup of removed markets is paged: read this many rows, push isInStock: 0
// for them, then delete the accepted ones before moving to the next page.
const CLEANUP_PAGE_SIZE = 250;

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

function sumCountryStats(stats: Record<string, CountryStats>): CountryStats {
  return Object.values(stats).reduce<CountryStats>(
    (acc, countryStats) => ({
      synced: acc.synced + countryStats.synced,
      skipped: acc.skipped + countryStats.skipped,
      failed: acc.failed + countryStats.failed,
      total: acc.total + countryStats.total,
    }),
    createEmptyCountryStats(),
  );
}

/**
 * Maps a staged pricing row to a Yespo market product item.
 *
 * Products that are not in the market's attached catalog never reach the staging table,
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
 *
 * `marketId` limits the catalog send to that Shopify market. Cleanup of
 * removed countries still compares the full enabled set, so a single-market
 * run does not zero out the other markets.
 */
export const marketSyncHandler = async (
  shop: string,
  accessToken: string,
  apiKey: string,
  shopId: number,
  orgId?: number | null,
  siteId?: string | null,
  marketId?: string | null,
) => {
  console.log(
    marketId
      ? `⏳ Market sync start for ${shop} (market ${marketId})`
      : `⏳ Market sync start for ${shop}`,
  );

  const shopData = await shopRepository.getShop(shop);
  if (!shopData) {
    console.log(`⚠️ Market sync: shop not found for ${shop}`);
    return;
  }
  const logDomain = shopData.domain || shop;
  const marketSyncEnabled = Boolean(shopData.isMarketSyncEnabled);

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
    // Countries of an enabled market with no catalog stay in this list, so
    // this pass does not treat that market as removed.
    await cleanupRemovedMarkets({
      shopId,
      apiKey,
      shop,
      logDomain,
      orgId,
      siteId,
      currentCountries: marketsConfig.countries,
    });

    // A markets webhook turns the flag off only after this job is queued, so
    // cleanup above still runs. Skip the catalog bulk when sync is disabled.
    if (!marketSyncEnabled) {
      console.log(`⚠️ Market sync disabled for ${shop}`);
      return;
    }

    const previousShopMarkets = await shopMarketRepository.getByShopId(shopId);
    const previousLocalesByMarketId = new Map(
      previousShopMarkets.map((market) => [market.marketId, market.locales]),
    );

    if (marketId) {
      const selected = selectMarketsForSync(marketsConfig, marketId);
      if (!selected) {
        console.log(
          `⚠️ Market ${marketId} is not enabled for ${shop}, skipping catalog sync`,
        );
        return;
      }
      const market = selected.markets[0];
      if (!market) {
        console.log(
          `⚠️ Market ${marketId} is not enabled for ${shop}, skipping catalog sync`,
        );
        return;
      }
      await shopMarketRepository.upsertMarket(shopId, market);
      marketsConfig = selected;
    } else {
      await shopMarketRepository.replaceAll(shopId, marketsConfig.markets);
    }

    const onlineStoreMarkets = marketsConfig.markets.filter(
      (market) => market.catalogPublicationIds.length === 0,
    );
    if (onlineStoreMarkets.length > 0) {
      const names = onlineStoreMarkets.map((market) => market.name).join(", ");
      const verb = onlineStoreMarkets.length === 1 ? "has" : "have";
      console.log(
        `ℹ️ ${names} ${verb} no catalog for ${shop}. Syncing products published to the Online Store.`,
      );
    }

    if (marketsConfig.countries.length === 0) {
      console.log(`⚠️ No enabled markets for ${shop}`);
      return;
    }

    Object.assign(stats, initCountryStats(marketsConfig.countries));
    for (const countryCode of marketsConfig.countries) {
      await writeLog(countryCode, "IN_PROGRESS");
    }

    const queryChunks = buildBulkQueryChunks(marketsConfig);

    for (const chunk of queryChunks) {
      const batchId = await runBulkQuery({
        client,
        query: chunk.query,
        orgId,
        domain: logDomain,
      });
      for (const countryCode of chunk.countries) {
        await writeLog(countryCode, "IN_PROGRESS", batchId);
      }

      const bulkResult = await waitForBulkOperation({
        client,
        orgId,
        domain: logDomain,
      });

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

      const presentByCountry = await processBatch({
        shopId,
        batchId,
        apiKey,
        logDomain,
        orgId,
        siteId,
        countries: chunk.countries,
        stats,
      });

      await clearProductsRemovedFromCatalog({
        shopId,
        apiKey,
        shop,
        logDomain,
        orgId,
        siteId,
        countries: chunk.countries,
        presentByCountry,
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

    const totals = sumCountryStats(stats);
    await sendLogEvent({
      orgId,
      errorMessage: "",
      data: JSON.stringify({
        domain: logDomain,
        countries: marketsConfig.countries,
        synced: totals.synced,
        skipped: totals.skipped,
        failed: totals.failed,
        total: totals.total,
      }),
      message: EVENT_MESSAGES.CUSTOM_LOG_SEND_MARKET_PRODUCTS_SUCCESS,
      logLevel: "INFO",
    });
  } catch (error: unknown) {
    console.error("Market sync error", error);
    for (const countryCode of marketsConfig.countries) {
      await writeLog(countryCode, "ERROR");
    }

    const totals = sumCountryStats(stats);
    await sendLogEvent({
      orgId,
      errorMessage: `Market sync error: ${(error as Error)?.message ?? "unknown"}`,
      data: JSON.stringify({
        domain: logDomain,
        countries: marketsConfig.countries,
        synced: totals.synced,
        skipped: totals.skipped,
        failed: totals.failed,
        total: totals.total,
        statusCode: (error as { status?: number })?.status ?? 500,
      }),
      message: EVENT_MESSAGES.CUSTOM_LOG_SEND_MARKET_PRODUCTS_ERROR,
      logLevel: "ERROR",
    });
  }
};

async function getExistingSyncRows(
  shopId: number,
  keys: Array<{ productId: string; variantId: string; countryCode: string }>,
): Promise<MarketSyncRecord[]> {
  const existing: MarketSyncRecord[] = [];
  for (
    let index = 0;
    index < keys.length;
    index += EXISTING_SYNC_LOOKUP_CHUNK
  ) {
    const chunk = keys.slice(index, index + EXISTING_SYNC_LOOKUP_CHUNK);
    existing.push(...(await marketSyncRepository.getByKeys(shopId, chunk)));
  }
  return existing;
}

/**
 * Maps staged pricing rows for one bulk batch, skips unchanged items, and sends
 * the rest to Yespo grouped by market (country). Mutates `stats` in place.
 */
async function processBatch({
  shopId,
  batchId,
  apiKey,
  logDomain,
  orgId,
  siteId,
  countries,
  stats,
}: {
  shopId: number;
  batchId: string;
  apiKey: string;
  logDomain: string;
  orgId?: number | null;
  siteId?: string | null;
  countries: string[];
  stats: Record<string, CountryStats>;
}): Promise<Map<string, Set<string>>> {
  const rows = await tmpMarketSyncRepository.getByBatch(shopId, batchId);
  const presentByCountry = variantIdsPresentInCountry(rows);
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

  // Change detection: load existing sync state for this batch. The lookup is
  // chunked so a full catalog (thousands of variant × country keys) does not
  // build one query large enough to fail the whole run.
  const existing = await getExistingSyncRows(
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
    if (entries.length === 0) {
      continue;
    }

    let countrySynced = 0;
    const countryFailedItems: string[] = [];

    for (let index = 0; index < entries.length; index += API_CHUNK_SIZE) {
      const chunk = entries.slice(index, index + API_CHUNK_SIZE);

      const response = await updateMarketProducts({
        apiKey,
        siteId: siteId ?? "",
        markets: [
          { marketId: countryCode, products: chunk.map((c) => c.item) },
        ],
        domain: logDomain,
        orgId,
      });

      for (const entry of chunk) {
        if (response.failedItems.includes(entry.item.productId)) {
          stats[countryCode].failed += 1;
          countryFailedItems.push(entry.item.productId);
          continue;
        }

        stats[countryCode].synced += 1;
        countrySynced += 1;
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

    if (countryFailedItems.length > 0) {
      await sendLogEvent({
        orgId,
        errorMessage: `Market sync rejected ${countryFailedItems.length} item(s) for market ${countryCode}`,
        data: JSON.stringify({
          domain: logDomain,
          countryCode,
          synced: countrySynced,
          failedCount: countryFailedItems.length,
          failedItems: countryFailedItems,
        }),
        message: EVENT_MESSAGES.CUSTOM_LOG_SEND_MARKET_PRODUCTS_ERROR,
        logLevel: "ERROR",
      });
    } else {
      await sendLogEvent({
        orgId,
        errorMessage: "",
        data: JSON.stringify({
          domain: logDomain,
          countryCode,
          synced: countrySynced,
        }),
        message: EVENT_MESSAGES.CUSTOM_LOG_SEND_MARKET_PRODUCTS_SUCCESS,
        logLevel: "INFO",
      });
    }
  }

  return presentByCountry;
}

/**
 * After a country's bulk succeeded, variants still stored in MarketSync but
 * absent from that bulk are no longer in the catalog. Yespo has no market
 * delete, so they are removed from recommendations with isInStock: 0.
 * Runs only for countries in this successful batch, so a failed bulk never
 * zeroes a market.
 */
async function clearProductsRemovedFromCatalog({
  shopId,
  apiKey,
  shop,
  logDomain,
  orgId,
  siteId,
  countries,
  presentByCountry,
}: {
  shopId: number;
  apiKey: string;
  shop: string;
  logDomain: string;
  orgId?: number | null;
  siteId?: string | null;
  countries: string[];
  presentByCountry: Map<string, Set<string>>;
}): Promise<void> {
  for (const countryCode of countries) {
    const present = presentByCountry.get(countryCode) ?? new Set<string>();
    let afterId = 0;
    let removedCount = 0;

    while (true) {
      const rows = await marketSyncRepository.getByCountryPage(
        shopId,
        countryCode,
        afterId,
        CLEANUP_PAGE_SIZE,
      );
      if (rows.length === 0) {
        break;
      }
      afterId = rows[rows.length - 1].id;

      const removed = marketSyncRowsRemovedFromCatalog(rows, present);
      if (removed.length === 0) {
        continue;
      }

      await markMarketRowsOutOfStock({
        shopId,
        apiKey,
        logDomain,
        orgId,
        siteId,
        countryCode,
        rows: removed,
      });
      removedCount += removed.length;
    }

    if (removedCount > 0) {
      console.log(
        `🗑️ Marked ${removedCount} variant(s) out of stock in market ${countryCode} for ${shop}: removed from catalog`,
      );
    }
  }
}

/**
 * Sends isInStock: 0 for the given rows and deletes the ones Yespo accepted.
 */
async function markMarketRowsOutOfStock({
  shopId,
  apiKey,
  logDomain,
  orgId,
  siteId,
  countryCode,
  rows,
}: {
  shopId: number;
  apiKey: string;
  logDomain: string;
  orgId?: number | null;
  siteId?: string | null;
  countryCode: string;
  rows: MarketSyncRecord[];
}): Promise<string[]> {
  if (rows.length === 0) {
    return [];
  }

  const items: MarketProductItem[] = rows.map((row) => ({
    productId: row.variantId.split("/").pop() ?? row.variantId,
    updatedDate: new Date().toISOString(),
    isInStock: 0,
  }));

  const response = await updateMarketProducts({
    apiKey,
    siteId: siteId ?? "",
    markets: [{ marketId: countryCode, products: items }],
    domain: logDomain,
    orgId,
  });

  const pageFailed = new Set(response.failedItems);
  const deletableKeys = rows
    .filter(
      (row) => !pageFailed.has(row.variantId.split("/").pop() ?? row.variantId),
    )
    .map((row) => ({
      productId: row.productId,
      variantId: row.variantId,
      countryCode,
    }));

  await marketSyncRepository.deleteManyByKeys(shopId, deletableKeys);

  if (pageFailed.size > 0) {
    console.warn(
      `⚠️ ${pageFailed.size}/${rows.length} item(s) failed isInStock: 0 for market ${countryCode}, keeping their local records`,
    );
  }

  return [...pageFailed];
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
  logDomain,
  orgId,
  siteId,
  currentCountries,
}: {
  shopId: number;
  apiKey: string;
  shop: string;
  logDomain: string;
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

  await clearSyncedMarketCountries({
    shopId,
    apiKey,
    shop,
    logDomain,
    orgId,
    siteId,
    countryCodes: removedCountries,
  });
}

/**
 * Sends `isInStock: 0` for every previously synced product in the given
 * countries and deletes the local rows Yespo accepted.
 */
async function clearSyncedMarketCountries({
  shopId,
  apiKey,
  shop,
  logDomain,
  orgId,
  siteId,
  countryCodes,
}: {
  shopId: number;
  apiKey: string;
  shop: string;
  logDomain: string;
  orgId?: number | null;
  siteId?: string | null;
  countryCodes: string[];
}): Promise<void> {
  for (const countryCode of countryCodes) {
    // Cursor on the autoincrement id: keeps the loop terminating even when some
    // rows fail and are intentionally left in place (their ids are still passed).
    let afterId = 0;
    let processedCount = 0;
    const failedItems: string[] = [];

    while (true) {
      const rows = await marketSyncRepository.getByCountryPage(
        shopId,
        countryCode,
        afterId,
        CLEANUP_PAGE_SIZE,
      );
      if (rows.length === 0) {
        break;
      }
      afterId = rows[rows.length - 1].id;

      const pageFailed = await markMarketRowsOutOfStock({
        shopId,
        apiKey,
        logDomain,
        orgId,
        siteId,
        countryCode,
        rows,
      });

      processedCount += rows.length;
      failedItems.push(...pageFailed);
    }

    if (processedCount === 0) {
      // Nothing left to clean up (e.g. log row without sync rows): drop the log.
      await marketSyncLogRepository.deleteByCountry(shopId, countryCode);
      continue;
    }

    if (failedItems.length > 0) {
      console.warn(
        `⚠️ ${failedItems.length}/${processedCount} item(s) failed cleanup for market ${countryCode}, keeping their local records`,
      );

      await sendLogEvent({
        orgId,
        errorMessage: `Market cleanup failed for ${failedItems.length} of ${processedCount} item(s) in market ${countryCode}`,
        data: JSON.stringify({
          domain: logDomain,
          countryCode,
          failedCount: failedItems.length,
          processedCount,
        }),
        message: EVENT_MESSAGES.CUSTOM_LOG_MARKET_SYNC_CLEANUP_ERROR,
        logLevel: "ERROR",
      });

      // Keep the MarketSyncLog row so the failure stays visible.
      continue;
    }

    await marketSyncLogRepository.deleteByCountry(shopId, countryCode);

    console.log(
      `✅ Cleaned up ${processedCount} product(s) from removed market ${countryCode} for ${shop}`,
    );

    await sendLogEvent({
      orgId,
      errorMessage: "",
      data: JSON.stringify({
        domain: logDomain,
        countryCode,
        removedCount: processedCount,
      }),
      message: EVENT_MESSAGES.CUSTOM_LOG_MARKET_SYNC_CLEANUP_SUCCESS,
      logLevel: "INFO",
    });
  }
}
