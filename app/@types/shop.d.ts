import type { Prisma, Shop, SyncLogStatus } from "@prisma/client";

export interface ShopData {
  id: string;
  myshopifyDomain: string;
  contactEmail: string;
  email: string;
  name: string;
  url: string;
  primaryDomain: {
    id: string;
    host: string;
  };
}

export interface ShopDataResponse {
  shop: ShopData;
}

export interface ShopResponse {
  shop: Shop;
}

export type Shop = Shop;
export type ShopCreate = Prisma.ShopCreateInput;
export type ShopUpdate = Prisma.ShopUpdateInput;

/**
 * A shop together with the minimal MarketSyncLog fields the market-sync cron
 * needs to compute concurrency and ordering (status + updatedAt per country).
 */
export type ShopWithMarketSyncLogs = Shop & {
  marketSyncLogs: Array<{
    status: SyncLogStatus;
    updatedAt: Date | null;
  }>;
};
