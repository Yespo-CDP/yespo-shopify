import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { finished } from "node:stream/promises";

import type { Prisma } from "@prisma/client";
import type { ShopMarketsConfig } from "~/@types/shopMarketsConfig";
import type { TmpMarketSyncCreate } from "~/@types/tmpMarketSync";
import { tmpMarketSyncRepository } from "~/repositories/repositories.server";

import {
  createBulkJsonlOutputWriter,
  getBulkJsonlOutputPath,
} from "./save-bulk-jsonl-output.server";
import {
  priceFieldAlias,
  publishedFieldAlias,
  translationFieldAlias,
} from "./product-sync-bulk-queries";

const TMP_INSERT_CHUNK_SIZE = 500;

interface BulkJsonlRow {
  id?: string;
  __parentId?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

type ProductPublishedInContext = Map<string, Record<string, boolean>>;

export async function streamBulkJsonlToTmpMarketSync({
  url,
  shop,
  batchId,
  shopId,
  config,
  countries,
}: {
  url: string;
  shop: string;
  batchId: string;
  shopId: number;
  config: ShopMarketsConfig;
  countries: string[];
}): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download bulk result: ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Bulk result response has no body");
  }

  const outputPath = await getBulkJsonlOutputPath(shop, batchId);
  const outputWriter = createBulkJsonlOutputWriter(outputPath);
  const stream = Readable.fromWeb(response.body as WebReadableStream);
  const readline = createInterface({ input: stream, crlfDelay: Infinity });
  let buffer: TmpMarketSyncCreate[] = [];
  const productPublishedInContext: ProductPublishedInContext = new Map();

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
        recordProductPublishedInContext({
          row,
          productId: id,
          countries,
          productPublishedInContext,
        });
        buffer.push(...parseProductRow({ row, batchId, shopId, config }));
      } else if (id.includes("/ProductVariant/")) {
        buffer.push(
          ...parseVariantRow({
            row,
            batchId,
            shopId,
            countries,
            productPublishedInContext,
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

function recordProductPublishedInContext({
  row,
  productId,
  countries,
  productPublishedInContext,
}: {
  row: BulkJsonlRow;
  productId: string;
  countries: string[];
  productPublishedInContext: ProductPublishedInContext;
}): void {
  const publishContext = Object.fromEntries(
    countries.map((countryCode) => [
      countryCode,
      row[publishedFieldAlias(countryCode)] === true,
    ]),
  );

  productPublishedInContext.set(productId, publishContext);
}

function parseProductRow({
  row,
  batchId,
  shopId,
  config,
}: {
  row: BulkJsonlRow;
  batchId: string;
  shopId: number;
  config: ShopMarketsConfig;
}): TmpMarketSyncCreate[] {
  const productId = row.id as string;
  const rows: TmpMarketSyncCreate[] = [];

  for (const market of config.markets) {
    for (const locale of market.locales) {
      const alias = translationFieldAlias(locale, market.handle);
      const translations = row[alias];
      if (!Array.isArray(translations) || translations.length === 0) {
        continue;
      }

      rows.push({
        batchId,
        productId,
        locale,
        marketId: market.id,
        payload: {
          type: "translation",
          productUpdatedAt: row.updatedAt,
          translations,
        } as Prisma.InputJsonValue,
        shop: { connect: { id: shopId } },
      });
    }
  }

  for (const locale of config.locales) {
    const alias = translationFieldAlias(locale, "global");
    const translations = row[alias];
    if (!Array.isArray(translations) || translations.length === 0) {
      continue;
    }

    rows.push({
      batchId,
      productId,
      locale,
      marketId: "",
      payload: {
        type: "translation",
        productUpdatedAt: row.updatedAt,
        translations,
      } as Prisma.InputJsonValue,
      shop: { connect: { id: shopId } },
    });
  }

  return rows;
}

function parseVariantRow({
  row,
  batchId,
  shopId,
  countries,
  productPublishedInContext,
}: {
  row: BulkJsonlRow;
  batchId: string;
  shopId: number;
  countries: string[];
  productPublishedInContext: ProductPublishedInContext;
}): TmpMarketSyncCreate[] {
  const variantId = row.id as string;
  const productId = row.__parentId as string;
  const publishContext = productPublishedInContext.get(productId) ?? {};
  const rows: TmpMarketSyncCreate[] = [];

  for (const countryCode of countries) {
    if (!publishContext[countryCode]) {
      continue;
    }

    const alias = priceFieldAlias(countryCode);
    const pricing = row[alias];
    if (!pricing) {
      continue;
    }

    rows.push({
      batchId,
      productId,
      variantId,
      countryCode,
      payload: {
        type: "pricing",
        variantUpdatedAt: row.updatedAt,
        pricing,
      } as Prisma.InputJsonValue,
      shop: { connect: { id: shopId } },
    });
  }

  return rows;
}
