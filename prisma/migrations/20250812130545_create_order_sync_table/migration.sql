-- CreateTable
CREATE TABLE "public"."OrderSync" (
    "id" SERIAL NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "shopId" INTEGER NOT NULL,

    CONSTRAINT "OrderSync_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."OrderSync" ADD CONSTRAINT "OrderSync_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "public"."Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
