import type {
  MarketSyncCreate,
  MarketSyncRecord,
  MarketSyncUpdate,
} from "~/@types/marketSync";

export default interface MarketSyncRepository {
  getByKeys(
    shopId: number,
    keys: Array<{ productId: string; variantId: string; countryCode: string }>,
  ): Promise<MarketSyncRecord[]>;

  createOrUpdate(data: MarketSyncCreate): Promise<MarketSyncRecord>;

  update(
    shopId: number,
    productId: string,
    variantId: string,
    countryCode: string,
    data: MarketSyncUpdate,
  ): Promise<MarketSyncRecord>;
}
