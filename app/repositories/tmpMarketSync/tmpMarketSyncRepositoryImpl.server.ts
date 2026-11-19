import type { PrismaClient } from "@prisma/client";

import type {
  TmpMarketSyncCreate,
  TmpMarketSyncRecord,
} from "~/@types/tmpMarketSync";
import type TmpMarketSyncRepository from "./tmpMarketSyncRepository.server";

export default class TmpMarketSyncRepositoryImpl
  implements TmpMarketSyncRepository
{
  constructor(readonly database: PrismaClient) {}

  async createMany(data: TmpMarketSyncCreate[]): Promise<number> {
    if (data.length === 0) {
      return 0;
    }

    const result = await this.database.tmpMarketSync.createMany({
      data: data.map((row) => ({
        batchId: row.batchId,
        productId: row.productId,
        variantId: row.variantId,
        countryCode: row.countryCode,
        locale: row.locale,
        marketId: row.marketId,
        payload: row.payload,
        shopId: row.shop?.connect?.id as number,
      })),
    });

    return result.count;
  }

  async getPage(
    shopId: number,
    batchId: string,
    afterId: number,
    take: number,
  ): Promise<TmpMarketSyncRecord[]> {
    return this.database.tmpMarketSync.findMany({
      where: { shopId, batchId, id: { gt: afterId } },
      orderBy: { id: "asc" },
      take,
    });
  }

  async deleteByBatch(shopId: number, batchId: string): Promise<void> {
    await this.database.tmpMarketSync.deleteMany({
      where: { shopId, batchId },
    });
  }

  /** Staging rows left behind by a run that crashed before its own cleanup. */
  async deleteOlderThan(date: Date): Promise<number> {
    const result = await this.database.tmpMarketSync.deleteMany({
      where: { createdAt: { lt: date } },
    });

    return result.count;
  }
}
