import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";

import EventDataRepositoryImpl from "../../../../app/repositories/eventData/eventDataRepositoryImpl.server";

const ttl = new Date("2030-01-15T00:00:00Z");
const data = {
  cartToken: "cart-1",
  sc: "sc-1",
  marketId: "ua",
  ttl,
  shopId: 7,
  customerId: "123",
};

const uniqueError = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "6.19.3",
  });

const createRepository = (upsert: () => Promise<unknown>) => {
  const eventData = {
    upsert: mock.fn(upsert),
    updateMany: mock.fn(async () => ({ count: 1 })),
    findFirst: mock.fn(async () => null),
  };
  const repository = new EventDataRepositoryImpl({ eventData } as unknown as PrismaClient);
  return { repository, eventData };
};

test("updates marketId, customer and ttl only when shop and sc match", async () => {
  const { repository, eventData } = createRepository(async () => ({}));

  await repository.createEventData(data);

  const args = eventData.upsert.mock.calls[0].arguments as unknown as [
    Prisma.EventDataUpsertArgs,
  ];
  assert.deepEqual(args[0].where, { cartToken: "cart-1", shopId: 7, sc: "sc-1" });
  assert.deepEqual(args[0].update, {
    marketId: "ua",
    ttl,
    customer: { connect: { customerId: "123" } },
  });
  assert.deepEqual(args[0].create.shop, { connect: { id: 7 } });
  assert.equal(eventData.updateMany.mock.callCount(), 0);
});

test("only extends ttl of the same shop's cart when the cart exists with another sc or shop", async () => {
  const { repository, eventData } = createRepository(async () => {
    throw uniqueError();
  });

  await repository.createEventData({ ...data, sc: "sc-2" });

  const args = eventData.updateMany.mock.calls[0].arguments as unknown as [
    Prisma.EventDataUpdateManyArgs,
  ];
  assert.deepEqual(args[0], {
    where: { cartToken: "cart-1", shopId: 7 },
    data: { ttl },
  });
});

test("rethrows other database errors", async () => {
  const { repository, eventData } = createRepository(async () => {
    throw new Error("connection lost");
  });

  await assert.rejects(repository.createEventData(data), /connection lost/);
  assert.equal(eventData.updateMany.mock.callCount(), 0);
});

test("reads event data of the given shop only", async () => {
  const { repository, eventData } = createRepository(async () => ({}));

  await repository.getEventData(7, "cart-1");

  const args = eventData.findFirst.mock.calls[0].arguments as unknown as [
    Prisma.EventDataFindFirstArgs,
  ];
  assert.deepEqual(args[0].where, { cartToken: "cart-1", shopId: 7 });
});
