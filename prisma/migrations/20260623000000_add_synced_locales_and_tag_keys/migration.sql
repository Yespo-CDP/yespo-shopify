-- Shop: track previously synced secondary locales to detect removed ones
ALTER TABLE "Shop" ADD COLUMN "syncedLocales" TEXT[] NOT NULL DEFAULT '{}';

-- ProductVariantSync: track previously synced tag keys to detect removed ones
ALTER TABLE "ProductVariantSync" ADD COLUMN "syncedTagKeys" TEXT[] NOT NULL DEFAULT '{}';
