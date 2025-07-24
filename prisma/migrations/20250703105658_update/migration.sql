/*
  Warnings:

  - You are about to drop the column `fistName` on the `Customer` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "fistName",
ADD COLUMN     "firstName" TEXT;
