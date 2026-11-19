import type { TmpMarketSyncCreate, TmpMarketSyncRecord } from "~/@types/tmpMarketSync";

export default interface TmpMarketSyncRepository {
  createMany(data: TmpMarketSyncCreate[]): Promise<number>;

  getPage(
    shopId: number,
    batchId: string,
    afterId: number,
    take: number,
  ): Promise<TmpMarketSyncRecord[]>;

  deleteByBatch(shopId: number, batchId: string): Promise<void>;

  deleteOlderThan(date: Date): Promise<number>;
}
