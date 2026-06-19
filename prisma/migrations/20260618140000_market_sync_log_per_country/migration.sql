-- DropIndex
DROP INDEX IF EXISTS "MarketSyncLog_shopId_key";

-- Clear legacy shop-level logs before per-country migration
DELETE FROM "MarketSyncLog";

-- AlterTable
ALTER TABLE "MarketSyncLog" ADD COLUMN "countryCode" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "MarketSyncLog_shopId_countryCode_key" ON "MarketSyncLog"("shopId", "countryCode");

-- CreateIndex
CREATE INDEX "MarketSyncLog_shopId_idx" ON "MarketSyncLog"("shopId");
