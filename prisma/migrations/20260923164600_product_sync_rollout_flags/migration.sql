-- AlterTable
ALTER TABLE "Shop" ADD COLUMN "productSyncAutoEnable" BOOLEAN DEFAULT false;
ALTER TABLE "Shop" ADD COLUMN "productSyncNoticePending" BOOLEAN DEFAULT false;

-- Existing shops that already sync customers and orders, but not products.
-- New shops created after this migration keep the default false.
UPDATE "Shop"
SET "productSyncAutoEnable" = true
WHERE "active" IS TRUE
  AND "isContactSyncEnabled" IS TRUE
  AND "isOrderSyncEnabled" IS TRUE
  AND "isProductVariantSyncEnabled" IS NOT TRUE;
