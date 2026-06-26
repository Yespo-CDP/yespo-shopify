import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { finished } from "node:stream/promises";

import type { Prisma } from "@prisma/client";
import type {
  ShopMarketConfig,
  ShopMarketsConfig,
} from "~/@types/shopMarketsConfig";
import type { TmpMarketSyncCreate } from "~/@types/tmpMarketSync";
import { tmpMarketSyncRepository } from "~/repositories/repositories.server";

import {
  createBulkJsonlOutputWriter,
  getBulkJsonlOutputPath,
} from "./save-bulk-jsonl-output.server";
import { priceFieldAlias, publishedFieldAlias } from "./product-sync-bulk-queries";
import { resolveMarketUrls } from "./resolve-market-urls";

const TMP_INSERT_CHUNK_SIZE = 500;

interface BulkJsonlRow {
  id?: string;
  __parentId?: string;
  handle?: string;
  updatedAt?: string;
  inventoryQuantity?: number | null;
  [key: string]: unknown;
}

interface ProductInfo {
  handle: string;
  publishContext: Record<string, boolean>;
}

type ProductInfoMap = Map<string, ProductInfo>;

/**
 * Streams the bulk-operation JSONL result into the TmpMarketSync staging table.
 *
 * Only pricing rows are produced (one per variant × published country). Each row
 * carries the data needed to build the Yespo /v1/markets product item: raw
 * contextual pricing, inventory, and the per-locale market URLs.
 */
export async function streamBulkJsonlToTmpMarketSync({
  url,
  shop,
  batchId,
  shopId,
  config,
  countries,
  previousLocalesByMarketId,
}: {
  url: string;
  shop: string;
  batchId: string;
  shopId: number;
  config: ShopMarketsConfig;
  countries: string[];
  previousLocalesByMarketId: Map<string, string[]>;
}): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download bulk result: ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Bulk result response has no body");
  }

  const countryToMarket = buildCountryToMarket(config);

  const outputPath = await getBulkJsonlOutputPath(shop, batchId);
  const outputWriter = createBulkJsonlOutputWriter(outputPath);
  const stream = Readable.fromWeb(response.body as WebReadableStream);
  const readline = createInterface({ input: stream, crlfDelay: Infinity });
  let buffer: TmpMarketSyncCreate[] = [];
  const productInfo: ProductInfoMap = new Map();

  try {
    for await (const line of readline) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      outputWriter.write(`${trimmed}\n`);

      const row = JSON.parse(trimmed) as BulkJsonlRow;
      const id = row.id ?? "";

      if (id.includes("/Product/") && !row.__parentId) {
        recordProductInfo({ row, productId: id, countries, productInfo });
      } else if (id.includes("/ProductVariant/")) {
        buffer.push(
          ...parseVariantRow({
            row,
            batchId,
            shopId,
            countries,
            productInfo,
            countryToMarket,
            previousLocalesByMarketId,
          }),
        );
      }

      if (buffer.length >= TMP_INSERT_CHUNK_SIZE) {
        await tmpMarketSyncRepository.createMany(buffer);
        buffer = [];
      }
    }

    if (buffer.length > 0) {
      await tmpMarketSyncRepository.createMany(buffer);
    }
  } finally {
    readline.close();
    outputWriter.end();
    await finished(outputWriter);
  }

  return outputPath;
}

/**
 * Maps each market country to its market config, so URLs can be resolved per
 * country. marketId is the country code; all countries in a market share the
 * market's per-locale root URLs.
 */
function buildCountryToMarket(
  config: ShopMarketsConfig,
): Map<string, ShopMarketConfig> {
  const map = new Map<string, ShopMarketConfig>();
  for (const market of config.markets) {
    for (const country of market.countries) {
      map.set(country, market);
    }
  }
  return map;
}

function recordProductInfo({
  row,
  productId,
  countries,
  productInfo,
}: {
  row: BulkJsonlRow;
  productId: string;
  countries: string[];
  productInfo: ProductInfoMap;
}): void {
  const publishContext = Object.fromEntries(
    countries.map((countryCode) => [
      countryCode,
      row[publishedFieldAlias(countryCode)] === true,
    ]),
  );

  productInfo.set(productId, {
    handle: row.handle ?? "",
    publishContext,
  });
}

function parseVariantRow({
  row,
  batchId,
  shopId,
  countries,
  productInfo,
  countryToMarket,
  previousLocalesByMarketId,
}: {
  row: BulkJsonlRow;
  batchId: string;
  shopId: number;
  countries: string[];
  productInfo: ProductInfoMap;
  countryToMarket: Map<string, ShopMarketConfig>;
  previousLocalesByMarketId: Map<string, string[]>;
}): TmpMarketSyncCreate[] {
  const variantId = row.id as string;
  const productId = row.__parentId as string;
  const info = productInfo.get(productId);
  const publishContext = info?.publishContext ?? {};
  const rows: TmpMarketSyncCreate[] = [];

  for (const countryCode of countries) {
    // Skip products not published in this market.
    if (!publishContext[countryCode]) {
      continue;
    }

    const pricing = row[priceFieldAlias(countryCode)];
    if (!pricing) {
      continue;
    }

    const market = countryToMarket.get(countryCode);
    const previousLocales = market
      ? (previousLocalesByMarketId.get(market.id) ?? [])
      : [];
    const variantNumericId = variantId.split("/").pop() ?? variantId;
    const urls = resolveMarketUrls(
      market,
      info?.handle ?? "",
      previousLocales,
      variantNumericId,
    );

    rows.push({
      batchId,
      productId,
      variantId,
      countryCode,
      payload: {
        type: "pricing",
        variantUpdatedAt: row.updatedAt,
        inventoryQuantity: row.inventoryQuantity ?? null,
        pricing,
        urls,
      } as Prisma.InputJsonValue,
      shop: { connect: { id: shopId } },
    });
  }

  return rows;
}
