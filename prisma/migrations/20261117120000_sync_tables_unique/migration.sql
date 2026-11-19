-- One sync row per (shop, entity): concurrent upserts used to insert duplicates.
-- Prisma sends this file as one query, so PostgreSQL runs it in one implicit
-- transaction: if any statement fails, nothing is applied.
-- The lock blocks writes (reads still work) until COMMIT, so no duplicate can
-- be inserted between the DELETE and the CREATE UNIQUE INDEX.
LOCK TABLE "CustomerSync", "OrderSync", "ProductVariantSync" IN SHARE ROW EXCLUSIVE MODE;

-- Remove existing duplicates. Keep the row with the latest updatedAt
-- (createdAt when updatedAt is NULL), then the highest id.
DELETE FROM "CustomerSync" a USING "CustomerSync" b
WHERE a."shopId" = b."shopId" AND a."customerId" = b."customerId"
  AND (COALESCE(a."updatedAt", a."createdAt"), a."id") < (COALESCE(b."updatedAt", b."createdAt"), b."id");

DELETE FROM "OrderSync" a USING "OrderSync" b
WHERE a."shopId" = b."shopId" AND a."orderId" = b."orderId"
  AND (COALESCE(a."updatedAt", a."createdAt"), a."id") < (COALESCE(b."updatedAt", b."createdAt"), b."id");

-- On equal timestamps keep a failed row, so the variant is sent again.
DELETE FROM "ProductVariantSync" a USING "ProductVariantSync" b
WHERE a."shopId" = b."shopId" AND a."variantId" = b."variantId"
  AND (COALESCE(a."updatedAt", a."createdAt"), a."syncFailed", a."id") < (COALESCE(b."updatedAt", b."createdAt"), b."syncFailed", b."id");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSync_shopId_customerId_key" ON "CustomerSync"("shopId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderSync_shopId_orderId_key" ON "OrderSync"("shopId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariantSync_shopId_variantId_key" ON "ProductVariantSync"("shopId", "variantId");
