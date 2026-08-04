-- AlterTable
ALTER TABLE "ProductVariantSync" ALTER COLUMN "syncedTagKeys" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "refreshTokenExpires" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Shop" ALTER COLUMN "syncedLocales" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ShopMarket" ALTER COLUMN "countries" DROP DEFAULT,
ALTER COLUMN "locales" DROP DEFAULT;
