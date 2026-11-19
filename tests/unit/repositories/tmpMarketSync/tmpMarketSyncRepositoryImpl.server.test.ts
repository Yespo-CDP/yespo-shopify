import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { PrismaClient } from "@prisma/client";

import TmpMarketSyncRepositoryImpl from "../../../../app/repositories/tmpMarketSync/tmpMarketSyncRepositoryImpl.server";

const createRepository = () => {
  const tmpMarketSync = {
    findMany: mock.fn(async (_args: unknown) => []),
    deleteMany: mock.fn(async (_args: unknown) => ({ count: 3 })),
  };
  const repository = new TmpMarketSyncRepositoryImpl({ tmpMarketSync } as unknown as PrismaClient);
  return { repository, tmpMarketSync };
};

test("getPage reads one batch after the given id in id order", async () => {
  const { repository, tmpMarketSync } = createRepository();

  await repository.getPage(1, "gid://shopify/BulkOperation/7", 42, 1000);

  assert.deepEqual(tmpMarketSync.findMany.mock.calls[0].arguments[0], {
    where: { shopId: 1, batchId: "gid://shopify/BulkOperation/7", id: { gt: 42 } },
    orderBy: { id: "asc" },
    take: 1000,
  });
});

test("deleteOlderThan deletes only rows created before the date and returns the count", async () => {
  const { repository, tmpMarketSync } = createRepository();
  const date = new Date("2026-11-17T00:00:00Z");

  const count = await repository.deleteOlderThan(date);

  assert.equal(count, 3);
  assert.deepEqual(tmpMarketSync.deleteMany.mock.calls[0].arguments[0], {
    where: { createdAt: { lt: date } },
  });
});
