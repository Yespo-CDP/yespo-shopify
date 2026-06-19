import type { PrismaClient } from "@prisma/client";

import type {
  MarketSyncCreate,
  MarketSyncRecord,
  MarketSyncUpdate,
} from "~/@types/marketSync";
import type MarketSyncRepository from "./marketSyncRepository.server";

export default class MarketSyncRepositoryImpl implements MarketSyncRepository {
  constructor(readonly database: PrismaClient) {}

  async getByKeys(
    shopId: number,
    keys: Array<{ productId: string; variantId: string; countryCode: string }>,
  ): Promise<MarketSyncRecord[]> {
    if (keys.length === 0) {
      return [];
    }

    return this.database.marketSync.findMany({
      where: {
        shopId,
        OR: keys.map((key) => ({
          productId: key.productId,
          variantId: key.variantId,
          countryCode: key.countryCode,
        })),
      },
    });
  }

  async createOrUpdate(data: MarketSyncCreate): Promise<MarketSyncRecord> {
    const shopId = data.shop?.connect?.id;
    if (!shopId) {
      throw new Error("shopId is required for MarketSync upsert");
    }

    return this.database.marketSync.upsert({
      where: {
        shopId_productId_variantId_countryCode: {
          shopId,
          productId: data.productId,
          variantId: data.variantId,
          countryCode: data.countryCode,
        },
      },
      create: data,
      update: {
        contentHash: data.contentHash,
        updatedAt: data.updatedAt,
      },
    });
  }

  async update(
    shopId: number,
    productId: string,
    variantId: string,
    countryCode: string,
    data: MarketSyncUpdate,
  ): Promise<MarketSyncRecord> {
    return this.database.marketSync.update({
      where: {
        shopId_productId_variantId_countryCode: {
          shopId,
          productId,
          variantId,
          countryCode,
        },
      },
      data,
    });
  }
}
