-- CreateTable
CREATE TABLE "GdprCustomerDataRequest" (
    "id" SERIAL NOT NULL,
    "webhookId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "shopId" INTEGER NOT NULL,

    CONSTRAINT "GdprCustomerDataRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GdprCustomerDataRequest_webhookId_key" ON "GdprCustomerDataRequest"("webhookId");

-- AddForeignKey
ALTER TABLE "GdprCustomerDataRequest" ADD CONSTRAINT "GdprCustomerDataRequest_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
