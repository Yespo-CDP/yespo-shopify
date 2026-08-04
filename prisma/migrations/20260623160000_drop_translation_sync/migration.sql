-- DropTable TranslationSync (market sync no longer tracks translations;
-- product translations are handled by the product sync via POST /v1/products).

-- DropForeignKey
ALTER TABLE "TranslationSync" DROP CONSTRAINT IF EXISTS "TranslationSync_shopId_fkey";

-- DropTable
DROP TABLE IF EXISTS "TranslationSync";
