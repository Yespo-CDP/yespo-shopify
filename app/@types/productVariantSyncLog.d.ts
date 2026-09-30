import type { Prisma, ProductVariantSyncLog, SyncLogStatus } from "@prisma/client";

export type SyncLogStatus = SyncLogStatus;
export type ProductVariantSyncLog = ProductVariantSyncLog;
export type ProductVariantSyncLogCreate = Prisma.ProductVariantSyncLogCreateInput;
export type ProductVariantSyncLogUpdate = Prisma.ProductVariantSyncLogUpdateInput;

/** Sync log plus the number of Shopify products behind the synced variants. */
export type ProductVariantSyncLogView = ProductVariantSyncLog & {
  syncedProductCount: number;
};
