import type { TmpMarketSyncCreate, TmpMarketSyncRecord } from "~/@types/tmpMarketSync";

export default interface TmpMarketSyncRepository {
  createMany(data: TmpMarketSyncCreate[]): Promise<number>;

  getByBatch(shopId: number, batchId: string): Promise<TmpMarketSyncRecord[]>;

  deleteByBatch(shopId: number, batchId: string): Promise<void>;
}
