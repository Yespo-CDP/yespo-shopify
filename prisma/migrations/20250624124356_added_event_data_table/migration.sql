-- CreateTable
CREATE TABLE "EventData" (
    "cartToken" TEXT NOT NULL,
    "sc" TEXT NOT NULL,
    "ttl" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "shopId" INTEGER NOT NULL,

    CONSTRAINT "EventData_pkey" PRIMARY KEY ("cartToken")
);

-- AddForeignKey
ALTER TABLE "EventData" ADD CONSTRAINT "EventData_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
