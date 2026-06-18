-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "isProductVariantSyncEnabled" BOOLEAN DEFAULT false;

-- CreateTable
CREATE TABLE "ProductVariantSyncLog" (
    "id" SERIAL NOT NULL,
    "syncedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "status" "SyncLogStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "shopId" INTEGER NOT NULL,

    CONSTRAINT "ProductVariantSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariantSync" (
    "id" SERIAL NOT NULL,
    "variantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "shopId" INTEGER NOT NULL,

    CONSTRAINT "ProductVariantSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariantSyncLog_shopId_key" ON "ProductVariantSyncLog"("shopId");

-- AddForeignKey
ALTER TABLE "ProductVariantSyncLog" ADD CONSTRAINT "ProductVariantSyncLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantSync" ADD CONSTRAINT "ProductVariantSync_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
