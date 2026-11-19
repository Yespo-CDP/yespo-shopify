import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";

import ProductVariantSyncRepositoryImpl from "../../../../app/repositories/productVariantSync/productVariantSyncRepositoryImpl.server";

const createRepository = () => {
  const productVariantSync = {
    findFirst: mock.fn(async () => null),
    findMany: mock.fn(async () => []),
    upsert: mock.fn(async () => ({})),
  };
  const repository = new ProductVariantSyncRepositoryImpl({
    productVariantSync,
  } as unknown as PrismaClient);
  return { repository, productVariantSync };
};

test("upserts by (shopId, variantId) with a scalar shopId", async () => {
  const { repository, productVariantSync } = createRepository();
  const updatedAt = new Date("2026-01-02T00:00:00Z");

  await repository.createOrUpdateProductVariantSync({
    variantId: "gid://shopify/ProductVariant/1",
    productId: "gid://shopify/Product/1",
    syncedTagKeys: ["color"],
    syncFailed: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt,
    shop: { connect: { id: 7 } },
  });

  assert.equal(productVariantSync.findFirst.mock.callCount(), 0);
  const [args] = productVariantSync.upsert.mock.calls[0]
    .arguments as unknown as [Prisma.ProductVariantSyncUpsertArgs];
  const fields = {
    variantId: "gid://shopify/ProductVariant/1",
    productId: "gid://shopify/Product/1",
    syncedTagKeys: ["color"],
    syncFailed: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt,
  };
  assert.deepEqual(args, {
    where: {
      shopId_variantId: {
        shopId: 7,
        variantId: "gid://shopify/ProductVariant/1",
      },
    },
    create: { ...fields, shopId: 7 },
    update: fields,
  });
});

test("looks up variant syncs of one shop only", async () => {
  const { repository, productVariantSync } = createRepository();

  await repository.getProductVariantSyncByVariantIds(7, ["a", "b"]);

  assert.deepEqual(productVariantSync.findMany.mock.calls[0].arguments, [
    { where: { shopId: 7, variantId: { in: ["a", "b"] } } },
  ]);
});
