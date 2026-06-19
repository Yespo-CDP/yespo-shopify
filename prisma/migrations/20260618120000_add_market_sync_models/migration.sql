-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "isMarketSyncEnabled" BOOLEAN DEFAULT false,
ADD COLUMN     "markets" JSONB;

-- CreateTable
CREATE TABLE "MarketSyncLog" (
    "id" SERIAL NOT NULL,
    "syncedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "status" "SyncLogStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "bulkBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "shopId" INTEGER NOT NULL,

    CONSTRAINT "MarketSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSync" (
    "id" SERIAL NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "contentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "shopId" INTEGER NOT NULL,

    CONSTRAINT "MarketSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TmpMarketSync" (
    "id" SERIAL NOT NULL,
    "batchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "countryCode" TEXT,
    "locale" TEXT,
    "marketId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shopId" INTEGER NOT NULL,

    CONSTRAINT "TmpMarketSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranslationSync" (
    "id" SERIAL NOT NULL,
    "productId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "marketId" TEXT NOT NULL DEFAULT '',
    "contentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "shopId" INTEGER NOT NULL,

    CONSTRAINT "TranslationSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketSyncLog_shopId_key" ON "MarketSyncLog"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketSync_shopId_productId_variantId_countryCode_key" ON "MarketSync"("shopId", "productId", "variantId", "countryCode");

-- CreateIndex
CREATE INDEX "MarketSync_shopId_variantId_idx" ON "MarketSync"("shopId", "variantId");

-- CreateIndex
CREATE INDEX "TmpMarketSync_shopId_batchId_idx" ON "TmpMarketSync"("shopId", "batchId");

-- CreateIndex
CREATE UNIQUE INDEX "TranslationSync_shopId_productId_locale_marketId_key" ON "TranslationSync"("shopId", "productId", "locale", "marketId");

-- AddForeignKey
ALTER TABLE "MarketSyncLog" ADD CONSTRAINT "MarketSyncLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketSync" ADD CONSTRAINT "MarketSync_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TmpMarketSync" ADD CONSTRAINT "TmpMarketSync_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranslationSync" ADD CONSTRAINT "TranslationSync_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
