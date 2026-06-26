import type { PrismaClient } from "@prisma/client";

import type {
  MarketSyncLogCreate,
  MarketSyncLogRecord,
} from "~/@types/marketSyncLog";
import type MarketSyncLogRepository from "./marketSyncLogRepository.server";

export default class MarketSyncLogRepositoryImpl
  implements MarketSyncLogRepository
{
  constructor(readonly database: PrismaClient) {}

  async getByShop(shopUrl: string): Promise<MarketSyncLogRecord[]> {
    return this.database.marketSyncLog.findMany({
      where: {
        shop: { shopUrl },
      },
      orderBy: {
        countryCode: "asc",
      },
    });
  }

  async getByShopAndCountry(
    shopUrl: string,
    countryCode: string,
  ): Promise<MarketSyncLogRecord | null> {
    return this.database.marketSyncLog.findFirst({
      where: {
        shop: { shopUrl },
        countryCode,
      },
    });
  }

  async hasInProgressByShop(shopUrl: string): Promise<boolean> {
    const log = await this.database.marketSyncLog.findFirst({
      where: {
        shop: { shopUrl },
        status: "IN_PROGRESS",
      },
    });

    return log !== null;
  }

  async hasFreshInProgressByShop(
    shopUrl: string,
    staleBefore: Date,
  ): Promise<boolean> {
    const log = await this.database.marketSyncLog.findFirst({
      where: {
        shop: { shopUrl },
        status: "IN_PROGRESS",
        updatedAt: { gte: staleBefore },
      },
    });

    return log !== null;
  }

  async deleteByCountry(shopId: number, countryCode: string): Promise<void> {
    await this.database.marketSyncLog.deleteMany({
      where: { shopId, countryCode },
    });
  }

  async createOrUpdate(
    data: MarketSyncLogCreate,
  ): Promise<MarketSyncLogRecord> {
    const shopId = data.shop?.connect?.id;
    if (!shopId) {
      throw new Error("shopId is required for MarketSyncLog upsert");
    }

    if (!data.countryCode) {
      throw new Error("countryCode is required for MarketSyncLog upsert");
    }

    return this.database.marketSyncLog.upsert({
      where: {
        shopId_countryCode: {
          shopId,
          countryCode: data.countryCode,
        },
      },
      create: {
        countryCode: data.countryCode,
        syncedCount: data.syncedCount ?? 0,
        skippedCount: data.skippedCount ?? 0,
        failedCount: data.failedCount ?? 0,
        totalCount: data.totalCount ?? 0,
        status: data.status,
        bulkBatchId: data.bulkBatchId,
        shop: data.shop,
      },
      update: {
        syncedCount: data.syncedCount,
        skippedCount: data.skippedCount,
        failedCount: data.failedCount,
        totalCount: data.totalCount,
        status: data.status,
        bulkBatchId: data.bulkBatchId,
      },
    });
  }
}
