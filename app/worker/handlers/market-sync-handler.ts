import {
  updateMarketProducts,
  updateMarketTranslations,
  type MarketProductPayload,
  type MarketTranslationPayload,
} from "~/api/update-market-products";
import {
  marketSyncLogRepository,
  marketSyncRepository,
  shopMarketRepository,
  shopRepository,
  tmpMarketSyncRepository,
  translationSyncRepository,
} from "~/repositories/repositories.server";
import type { ShopMarketsConfig } from "~/@types/shopMarketsConfig";
import type { TmpMarketSyncRecord } from "~/@types/tmpMarketSync";

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

interface CountrySyncStats {
  synced: number;
  skipped: number;
  failed: number;
  total: number;
}

function createEmptyCountryStats(): CountrySyncStats {
  return { synced: 0, skipped: 0, failed: 0, total: 0 };
}

function initCountryStats(
  countries: string[],
): Record<string, CountrySyncStats> {
  return Object.fromEntries(
    countries.map((countryCode) => [countryCode, createEmptyCountryStats()]),
  );
}

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
  const countryStats = initCountryStats([]);

  try {
    marketsConfig = await fetchShopMarketsConfig({ client });

    if (marketsConfig.countries.length === 0) {
      console.log(`⚠️ No enabled market countries for ${shop}`);
      return;
    }

    Object.assign(countryStats, initCountryStats(marketsConfig.countries));

    for (const countryCode of marketsConfig.countries) {
      await marketSyncLogRepository.createOrUpdate({
        countryCode,
        status: "IN_PROGRESS",
        syncedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        totalCount: 0,
        shop: { connect: { id: shopId } },
      });
    }

    await shopMarketRepository.replaceAll(shopId, marketsConfig.markets);

    const queryChunks = buildBulkQueryChunks(marketsConfig);

    for (const chunk of queryChunks) {
      const batchId = await runBulkQuery({ client, query: chunk.query });

      for (const countryCode of chunk.countries) {
        await marketSyncLogRepository.createOrUpdate({
          countryCode,
          status: "IN_PROGRESS",
          bulkBatchId: batchId,
          syncedCount: countryStats[countryCode]?.synced ?? 0,
          skippedCount: countryStats[countryCode]?.skipped ?? 0,
          failedCount: countryStats[countryCode]?.failed ?? 0,
          totalCount: countryStats[countryCode]?.total ?? 0,
          shop: { connect: { id: shopId } },
        });
      }

      const bulkResult = await waitForBulkOperation({ client });

      const outputPath = await streamBulkJsonlToTmpMarketSync({
        url: bulkResult.url,
        shop,
        batchId,
        shopId,
        config: marketsConfig,
        countries: chunk.countries,
      });

      console.log(`Bulk JSONL saved to ${outputPath}`);

      const batchStats = await processTmpBatch({
        shopId,
        batchId,
        apiKey,
        shop,
        orgId,
        siteId,
        countries: chunk.countries,
      });

      for (const countryCode of chunk.countries) {
        const stats = batchStats.pricingByCountry[countryCode];
        if (!stats) {
          continue;
        }

        countryStats[countryCode].synced += stats.synced;
        countryStats[countryCode].skipped += stats.skipped;
        countryStats[countryCode].failed += stats.failed;
        countryStats[countryCode].total += stats.total;

        await marketSyncLogRepository.createOrUpdate({
          countryCode,
          status: "IN_PROGRESS",
          bulkBatchId: batchId,
          syncedCount: countryStats[countryCode].synced,
          skippedCount: countryStats[countryCode].skipped,
          failedCount: countryStats[countryCode].failed,
          totalCount: countryStats[countryCode].total,
          shop: { connect: { id: shopId } },
        });
      }

      await tmpMarketSyncRepository.deleteByBatch(shopId, batchId);
    }

    for (const countryCode of marketsConfig.countries) {
      await marketSyncLogRepository.createOrUpdate({
        countryCode,
        status: "COMPLETE",
        syncedCount: countryStats[countryCode].synced,
        skippedCount: countryStats[countryCode].skipped,
        failedCount: countryStats[countryCode].failed,
        totalCount: countryStats[countryCode].total,
        shop: { connect: { id: shopId } },
      });
    }

    console.log(`✅ Market sync finish for ${shop}`);
  } catch (error: unknown) {
    console.error("Market sync error", error);

    for (const countryCode of marketsConfig.countries) {
      await marketSyncLogRepository.createOrUpdate({
        countryCode,
        status: "ERROR",
        syncedCount: countryStats[countryCode]?.synced ?? 0,
        skippedCount: countryStats[countryCode]?.skipped ?? 0,
        failedCount: countryStats[countryCode]?.failed ?? 0,
        totalCount: countryStats[countryCode]?.total ?? 0,
        shop: { connect: { id: shopId } },
      });
    }
  }
};

async function processTmpBatch({
  shopId,
  batchId,
  apiKey,
  shop,
  orgId,
  siteId,
  countries,
}: {
  shopId: number;
  batchId: string;
  apiKey: string;
  shop: string;
  orgId?: number | null;
  siteId?: string | null;
  countries: string[];
}): Promise<{ pricingByCountry: Record<string, CountrySyncStats> }> {
  const rows = await tmpMarketSyncRepository.getByBatch(shopId, batchId);
  const pricingRows = rows.filter((row) => row.countryCode && row.variantId);
  const translationRows = rows.filter((row) => row.locale);

  const pricingByCountry = initCountryStats(countries);
  for (const row of pricingRows) {
    const countryCode = row.countryCode as string;
    if (pricingByCountry[countryCode]) {
      pricingByCountry[countryCode].total += 1;
    }
  }

  const pricingStatsByCountry = await processPricingRows({
    rows: pricingRows,
    shopId,
    apiKey,
    shop,
    orgId,
    siteId,
    countries,
  });

  for (const countryCode of countries) {
    pricingByCountry[countryCode] = {
      total: pricingByCountry[countryCode].total,
      ...pricingStatsByCountry[countryCode],
    };
  }

  await processTranslationRows({
    rows: translationRows,
    shopId,
    apiKey,
    shop,
    orgId,
    siteId,
  });

  return { pricingByCountry };
}

async function processPricingRows({
  rows,
  shopId,
  apiKey,
  shop,
  orgId,
  siteId,
  countries,
}: {
  rows: TmpMarketSyncRecord[];
  shopId: number;
  apiKey: string;
  shop: string;
  orgId?: number | null;
  siteId?: string | null;
  countries: string[];
}): Promise<
  Record<string, Pick<CountrySyncStats, "synced" | "skipped" | "failed">>
> {
  const statsByCountry = Object.fromEntries(
    countries.map((countryCode) => [
      countryCode,
      { synced: 0, skipped: 0, failed: 0 },
    ]),
  ) as Record<string, Pick<CountrySyncStats, "synced" | "skipped" | "failed">>;

  const toSync: MarketProductPayload[] = [];

  const existing = await marketSyncRepository.getByKeys(
    shopId,
    rows.map((row) => ({
      productId: row.productId,
      variantId: row.variantId as string,
      countryCode: row.countryCode as string,
    })),
  );

  for (const row of rows) {
    const countryCode = row.countryCode as string;
    const countryStats = statsByCountry[countryCode];
    if (!countryStats) {
      continue;
    }

    const payload = row.payload as Record<string, unknown>;
    const contentHash = computeContentHash(payload.pricing);
    const variantUpdatedAt = payload.variantUpdatedAt as string | undefined;
    const entityUpdatedAt = variantUpdatedAt
      ? new Date(variantUpdatedAt).getTime()
      : 0;

    const existingRow = existing.find(
      (item) =>
        item.productId === row.productId &&
        item.variantId === row.variantId &&
        item.countryCode === row.countryCode,
    );
    const syncUpdatedAt = existingRow?.updatedAt?.getTime() ?? 0;

    if (
      existingRow?.contentHash === contentHash &&
      entityUpdatedAt <= syncUpdatedAt
    ) {
      countryStats.skipped++;
      continue;
    }

    toSync.push({
      productId: row.productId,
      variantId: row.variantId as string,
      countryCode,
      pricing: payload.pricing,
      variantUpdatedAt,
    });
  }

  for (let index = 0; index < toSync.length; index += API_CHUNK_SIZE) {
    const chunk = toSync.slice(index, index + API_CHUNK_SIZE);
    // FIXME: Replace with a real HTTP call once the Yespo endpoint is available:
    const response = await updateMarketProducts({
      apiKey,
      siteId: siteId ?? "",
      items: chunk,
      domain: shop,
      orgId,
    });

    for (const item of chunk) {
      const countryStats = statsByCountry[item.countryCode];
      if (!countryStats) {
        continue;
      }

      if (response.failedItems.includes(item.variantId)) {
        countryStats.failed++;
        continue;
      }

      countryStats.synced++;

      await marketSyncRepository.createOrUpdate({
        productId: item.productId,
        variantId: item.variantId,
        countryCode: item.countryCode,
        contentHash: computeContentHash(item.pricing),
        updatedAt: item.variantUpdatedAt
          ? new Date(item.variantUpdatedAt)
          : new Date(),
        shop: { connect: { id: shopId } },
      });
    }
  }

  return statsByCountry;
}

async function processTranslationRows({
  rows,
  shopId,
  apiKey,
  shop,
  orgId,
  siteId,
}: {
  rows: TmpMarketSyncRecord[];
  shopId: number;
  apiKey: string;
  shop: string;
  orgId?: number | null;
  siteId?: string | null;
}): Promise<void> {
  const toSync: MarketTranslationPayload[] = [];

  const existing = await translationSyncRepository.getByKeys(
    shopId,
    rows.map((row) => ({
      productId: row.productId,
      locale: row.locale as string,
      marketId: row.marketId ?? "",
    })),
  );

  for (const row of rows) {
    const payload = row.payload as Record<string, unknown>;
    const translations = payload.translations;
    const contentHash = computeContentHash(translations);
    const productUpdatedAt = payload.productUpdatedAt as string | undefined;
    const entityUpdatedAt = productUpdatedAt
      ? new Date(productUpdatedAt).getTime()
      : 0;

    const marketId = row.marketId ?? "";
    const existingRow = existing.find(
      (item) =>
        item.productId === row.productId &&
        item.locale === row.locale &&
        item.marketId === marketId,
    );
    const syncUpdatedAt = existingRow?.updatedAt?.getTime() ?? 0;

    if (
      existingRow?.contentHash === contentHash &&
      entityUpdatedAt <= syncUpdatedAt
    ) {
      continue;
    }

    toSync.push({
      productId: row.productId,
      locale: row.locale as string,
      marketId,
      translations,
      productUpdatedAt,
    });
  }

  for (let index = 0; index < toSync.length; index += API_CHUNK_SIZE) {
    const chunk = toSync.slice(index, index + API_CHUNK_SIZE);
    const response = await updateMarketTranslations({
      apiKey,
      siteId: siteId ?? "",
      items: chunk,
      domain: shop,
      orgId,
    });

    for (const item of chunk) {
      const itemKey = `${item.productId}:${item.locale}:${item.marketId}`;
      if (response.failedItems.includes(itemKey)) {
        continue;
      }

      await translationSyncRepository.createOrUpdate({
        productId: item.productId,
        locale: item.locale,
        marketId: item.marketId,
        contentHash: computeContentHash(item.translations),
        updatedAt: item.productUpdatedAt
          ? new Date(item.productUpdatedAt)
          : new Date(),
        shop: { connect: { id: shopId } },
      });
    }
  }
}
