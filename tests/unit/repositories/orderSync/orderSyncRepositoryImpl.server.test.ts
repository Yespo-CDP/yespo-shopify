import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";

import OrderSyncRepositoryImpl from "../../../../app/repositories/orderSync/orderSyncRepositoryImpl.server";

const createRepository = () => {
  const orderSync = {
    findFirst: mock.fn(async () => null),
    findMany: mock.fn(async () => []),
    upsert: mock.fn(async () => ({})),
  };
  const repository = new OrderSyncRepositoryImpl({
    orderSync,
  } as unknown as PrismaClient);
  return { repository, orderSync };
};

test("upserts by (shopId, orderId) with a scalar shopId", async () => {
  const { repository, orderSync } = createRepository();

  await repository.createOrUpdateOrderSync({
    orderId: "gid://shopify/Order/1",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    shop: { connect: { id: 7 } },
  });

  assert.equal(orderSync.findFirst.mock.callCount(), 0);
  const [args] = orderSync.upsert.mock.calls[0].arguments as unknown as [
    Prisma.OrderSyncUpsertArgs,
  ];
  assert.deepEqual(args, {
    where: {
      shopId_orderId: { shopId: 7, orderId: "gid://shopify/Order/1" },
    },
    create: {
      orderId: "gid://shopify/Order/1",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
      shopId: 7,
    },
    update: {
      orderId: "gid://shopify/Order/1",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
    },
  });
});

test("looks up order syncs of one shop only", async () => {
  const { repository, orderSync } = createRepository();

  await repository.getOrderSyncByOrderIds(7, ["a", "b"]);

  assert.deepEqual(orderSync.findMany.mock.calls[0].arguments, [
    { where: { shopId: 7, orderId: { in: ["a", "b"] } } },
  ]);
});
