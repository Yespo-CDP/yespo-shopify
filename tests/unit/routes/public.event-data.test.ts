import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const upsertCustomer = mock.fn(async (data: { customerId: string }) => data);
const createEventData = mock.fn(async (_data: unknown) => {});

mock.module("../../../app/repositories/repositories.server", {
  namedExports: {
    customerRepository: { upsertCustomer },
    eventDataRepository: { createEventData },
    shopRepository: { getShopByDomain: async () => ({ id: 7 }) },
  },
});

const { action } = await import("../../../app/routes/public.event-data");

const post = (body: unknown) =>
  action({
    request: new Request("https://app.example/public/event-data", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  } as Parameters<typeof action>[0]);

const base = { shop: "demo.myshopify.com", sc: "sc-1", cartToken: "cart-1" };

beforeEach(() => {
  upsertCustomer.mock.resetCalls();
  createEventData.mock.resetCalls();
});

test("passes only the expected customer fields to upsertCustomer", async () => {
  const response = await post({
    ...base,
    customer: {
      id: 123,
      email: "buyer@example.com",
      phone: null,
      firstName: "Ann",
      lastName: { set: "x" },
      eventsData: { connect: { cartToken: "other-cart" } },
      shop: { create: { shopUrl: "evil.myshopify.com" } },
      createdAt: "2020-01-01",
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(upsertCustomer.mock.calls[0].arguments[0], {
    customerId: "123",
    email: "buyer@example.com",
    phone: null,
    firstName: "Ann",
    lastName: undefined,
  });
  const eventData = createEventData.mock.calls[0].arguments[0] as Record<string, unknown>;
  assert.equal(eventData.customerId, "123");
  assert.equal(eventData.shopId, 7);
});

test("drops too long and missing customer fields", async () => {
  await post({
    ...base,
    customer: { id: "456", email: "a".repeat(256) },
  });

  assert.deepEqual(upsertCustomer.mock.calls[0].arguments[0], {
    customerId: "456",
    email: undefined,
    phone: undefined,
    firstName: undefined,
    lastName: undefined,
  });
});

test("ignores a customer with an invalid id but still saves the cart", async () => {
  for (const id of [undefined, "12a", { gt: 1 }, 1.5]) {
    await post({ ...base, customer: { id, email: "buyer@example.com" } });
  }

  assert.equal(upsertCustomer.mock.callCount(), 0);
  assert.equal(createEventData.mock.callCount(), 4);
  for (const call of createEventData.mock.calls) {
    const eventData = call.arguments[0] as Record<string, unknown>;
    assert.equal(eventData.customerId, undefined);
    assert.equal(eventData.cartToken, "cart-1");
  }
});

test("ignores a request whose shop, cartToken or sc is not a short string", async () => {
  await post({ ...base, shop: { not: "x" } });
  await post({ ...base, cartToken: { not: "x" } });
  await post({ ...base, sc: "s".repeat(256) });

  assert.equal(createEventData.mock.callCount(), 0);
  assert.equal(upsertCustomer.mock.callCount(), 0);
});

test("does not log the request body", async () => {
  const log = mock.method(console, "log", () => {});
  try {
    await post({ ...base, customer: { id: 1, email: "buyer@example.com" } });
    assert.equal(log.mock.callCount(), 0);
  } finally {
    log.mock.restore();
  }
});
