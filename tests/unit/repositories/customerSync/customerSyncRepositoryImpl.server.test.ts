import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";

import CustomerSyncRepositoryImpl from "../../../../app/repositories/customerSync/customerSyncRepositoryImpl.server";

const createRepository = () => {
  const customerSync = {
    findFirst: mock.fn(async () => null),
    findMany: mock.fn(async () => []),
    upsert: mock.fn(async () => ({})),
  };
  const repository = new CustomerSyncRepositoryImpl({
    customerSync,
  } as unknown as PrismaClient);
  return { repository, customerSync };
};

test("upserts by (shopId, customerId) with a scalar shopId", async () => {
  const { repository, customerSync } = createRepository();

  await repository.createOrUpdateCustomerSync({
    customerId: "gid://shopify/Customer/1",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    shop: { connect: { id: 7 } },
  });

  assert.equal(customerSync.findFirst.mock.callCount(), 0);
  const [args] = customerSync.upsert.mock.calls[0].arguments as unknown as [
    Prisma.CustomerSyncUpsertArgs,
  ];
  assert.deepEqual(args, {
    where: {
      shopId_customerId: { shopId: 7, customerId: "gid://shopify/Customer/1" },
    },
    create: {
      customerId: "gid://shopify/Customer/1",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
      shopId: 7,
    },
    update: {
      customerId: "gid://shopify/Customer/1",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
    },
  });
});

test("looks up customer syncs of one shop only", async () => {
  const { repository, customerSync } = createRepository();

  await repository.getCustomerSyncByCustomerIds(7, ["a", "b"]);

  assert.deepEqual(customerSync.findMany.mock.calls[0].arguments, [
    { where: { shopId: 7, customerId: { in: ["a", "b"] } } },
  ]);
});
