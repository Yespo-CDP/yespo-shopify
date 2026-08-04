-- ============================================================
-- Squashed migration (replaces 5 separate migrations):
--   20260618120000_add_market_sync_models
--   20260618130000_drop_markets_fetched_at
--   20260618140000_market_sync_log_per_country
--   20260622000000_add_default_language_code
--   20260622000001_add_shop_currency  (renamed to defaultCurrency)
--
-- Additional changes vs the originals:
--   - "currency"    renamed to "defaultCurrency"
--   - "markets Json?" removed from Shop
--   - New ShopMarket table replaces the JSON markets field
-- ============================================================

-- AlterTable Shop
ALTER TABLE "Shop"
  ADD COLUMN "isMarketSyncEnabled"  BOOLEAN DEFAULT false,
  ADD COLUMN "defaultLanguageCode"  TEXT,
  ADD COLUMN "defaultCurrency"      TEXT;

-- Drop legacy columns if they exist (safe for both fresh and existing DBs)
ALTER TABLE "Shop" DROP COLUMN IF EXISTS "markets";
ALTER TABLE "Shop" DROP COLUMN IF EXISTS "marketsFetchedAt";

-- CreateTable ShopMarket
CREATE TABLE "ShopMarket" (
    "id"         SERIAL       NOT NULL,
    "marketId"   TEXT         NOT NULL,
    "name"       TEXT         NOT NULL,
    "handle"     TEXT         NOT NULL,
    "enabled"    BOOLEAN      NOT NULL DEFAULT true,
    "countries"  TEXT[]       NOT NULL DEFAULT '{}',
    "locales"    TEXT[]       NOT NULL DEFAULT '{}',
    "shopId"     INTEGER      NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3),

    CONSTRAINT "ShopMarket_pkey" PRIMARY KEY ("id")
);

-- CreateTable MarketSyncLog
CREATE TABLE "MarketSyncLog" (
    "id"           SERIAL         NOT NULL,
    "countryCode"  TEXT           NOT NULL,
    "syncedCount"  INTEGER        NOT NULL DEFAULT 0,
    "skippedCount" INTEGER        NOT NULL DEFAULT 0,
    "failedCount"  INTEGER        NOT NULL DEFAULT 0,
    "totalCount"   INTEGER        NOT NULL DEFAULT 0,
    "status"       "SyncLogStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "bulkBatchId"  TEXT,
    "createdAt"    TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3),
    "shopId"       INTEGER        NOT NULL,

    CONSTRAINT "MarketSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable MarketSync
CREATE TABLE "MarketSync" (
    "id"          SERIAL       NOT NULL,
    "productId"   TEXT         NOT NULL,
    "variantId"   TEXT         NOT NULL,
    "countryCode" TEXT         NOT NULL,
    "contentHash" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3),
    "shopId"      INTEGER      NOT NULL,

    CONSTRAINT "MarketSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable TmpMarketSync
CREATE TABLE "TmpMarketSync" (
    "id"          SERIAL       NOT NULL,
    "batchId"     TEXT         NOT NULL,
    "productId"   TEXT         NOT NULL,
    "variantId"   TEXT,
    "countryCode" TEXT,
    "locale"      TEXT,
    "marketId"    TEXT,
    "payload"     JSONB        NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shopId"      INTEGER      NOT NULL,

    CONSTRAINT "TmpMarketSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable TranslationSync
CREATE TABLE "TranslationSync" (
    "id"          SERIAL       NOT NULL,
    "productId"   TEXT         NOT NULL,
    "locale"      TEXT         NOT NULL,
    "marketId"    TEXT         NOT NULL DEFAULT '',
    "contentHash" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3),
    "shopId"      INTEGER      NOT NULL,

    CONSTRAINT "TranslationSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopMarket_shopId_marketId_key"
    ON "ShopMarket"("shopId", "marketId");

CREATE INDEX "ShopMarket_shopId_idx"
    ON "ShopMarket"("shopId");

CREATE UNIQUE INDEX "MarketSyncLog_shopId_countryCode_key"
    ON "MarketSyncLog"("shopId", "countryCode");

CREATE INDEX "MarketSyncLog_shopId_idx"
    ON "MarketSyncLog"("shopId");

CREATE UNIQUE INDEX "MarketSync_shopId_productId_variantId_countryCode_key"
    ON "MarketSync"("shopId", "productId", "variantId", "countryCode");

CREATE INDEX "MarketSync_shopId_variantId_idx"
    ON "MarketSync"("shopId", "variantId");

CREATE INDEX "TmpMarketSync_shopId_batchId_idx"
    ON "TmpMarketSync"("shopId", "batchId");

CREATE UNIQUE INDEX "TranslationSync_shopId_productId_locale_marketId_key"
    ON "TranslationSync"("shopId", "productId", "locale", "marketId");

-- AddForeignKey
ALTER TABLE "ShopMarket"
    ADD CONSTRAINT "ShopMarket_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketSyncLog"
    ADD CONSTRAINT "MarketSyncLog_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketSync"
    ADD CONSTRAINT "MarketSync_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TmpMarketSync"
    ADD CONSTRAINT "TmpMarketSync_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TranslationSync"
    ADD CONSTRAINT "TranslationSync_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
