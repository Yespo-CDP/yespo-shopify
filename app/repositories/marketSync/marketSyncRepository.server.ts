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

  /** Distinct country codes that have ever been synced for this shop. */
  getSyncedCountryCodes(shopId: number): Promise<string[]>;

  getByCountry(
    shopId: number,
    countryCode: string,
  ): Promise<MarketSyncRecord[]>;

  deleteByCountry(shopId: number, countryCode: string): Promise<void>;

  createOrUpdate(data: MarketSyncCreate): Promise<MarketSyncRecord>;

  update(
    shopId: number,
    productId: string,
    variantId: string,
    countryCode: string,
    data: MarketSyncUpdate,
  ): Promise<MarketSyncRecord>;
}
