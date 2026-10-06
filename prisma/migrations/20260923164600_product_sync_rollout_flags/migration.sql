-- AlterTable
ALTER TABLE "Shop" ADD COLUMN "productSyncAutoEnable" BOOLEAN DEFAULT false;
ALTER TABLE "Shop" ADD COLUMN "productSyncNoticePending" BOOLEAN DEFAULT false;

-- Existing active shops that do not already have product sync on.
-- Contact and order sync do not matter.
-- New shops created after this migration keep the default false.
UPDATE "Shop"
SET "productSyncAutoEnable" = true
WHERE "active" IS TRUE AND "isProductVariantSyncEnabled" IS NOT TRUE;
