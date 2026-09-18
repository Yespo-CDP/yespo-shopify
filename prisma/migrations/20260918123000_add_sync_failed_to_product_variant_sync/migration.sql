-- Track per-variant Yespo accept/reject so webhook flows can recount Data Sync stats.
ALTER TABLE "ProductVariantSync" ADD COLUMN "syncFailed" BOOLEAN NOT NULL DEFAULT false;
