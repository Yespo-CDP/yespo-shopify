-- AlterTable
ALTER TABLE "EventData" ADD COLUMN     "customerId" TEXT;

-- CreateTable
CREATE TABLE "Customer" (
    "customerId" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "fistName" TEXT,
    "lastName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("customerId")
);

-- AddForeignKey
ALTER TABLE "EventData" ADD CONSTRAINT "EventData_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("customerId") ON DELETE SET NULL ON UPDATE CASCADE;
