-- CreateEnum
CREATE TYPE "public"."SyncLogStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'ERROR', 'COMPLETE');

-- CreateTable
CREATE TABLE "public"."CustomerSyncLog" (
    "id" SERIAL NOT NULL,
    "syncedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."SyncLogStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "shopId" INTEGER NOT NULL,

    CONSTRAINT "CustomerSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSyncLog_shopId_key" ON "public"."CustomerSyncLog"("shopId");

-- AddForeignKey
ALTER TABLE "public"."CustomerSyncLog" ADD CONSTRAINT "CustomerSyncLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "public"."Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
