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

  /**
   * Whether a shop has a *fresh* IN_PROGRESS market sync, i.e. one updated at or
   * after `staleBefore`. Stale IN_PROGRESS rows (a crashed/restarted worker) are
   * ignored so the shop can be picked up again.
   */
  hasFreshInProgressByShop(
    shopUrl: string,
    staleBefore: Date,
  ): Promise<boolean>;

  deleteByCountry(shopId: number, countryCode: string): Promise<void>;

  createOrUpdate(data: MarketSyncLogCreate): Promise<MarketSyncLogRecord>;
}
