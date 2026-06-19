import type {
  MarketSyncLogCreate,
  MarketSyncLogRecord,
} from "~/@types/marketSyncLog";

export default interface MarketSyncLogRepository {
  getByShop(shopUrl: string): Promise<MarketSyncLogRecord[]>;

  getByShopAndCountry(
    shopUrl: string,
    countryCode: string,
  ): Promise<MarketSyncLogRecord | null>;

  hasInProgressByShop(shopUrl: string): Promise<boolean>;

  createOrUpdate(data: MarketSyncLogCreate): Promise<MarketSyncLogRecord>;
}
