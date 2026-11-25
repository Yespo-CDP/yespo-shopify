import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const STORED = new Date("2026-01-02T00:00:00Z");
const payload = {
  id: 7,
  admin_graphql_api_id: "gid://shopify/Customer/7",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  email: "a@b.c",
  default_address: { country_code: "UA" },
};

let stored: { updatedAt: Date | null }[] = [];
const getCustomerSyncByCustomerIds = mock.fn<
  (shopId: number, ids: string[]) => Promise<typeof stored>
>(async () => stored);
const createOrUpdateCustomerSync = mock.fn<(data: unknown) => Promise<object>>(
  async () => ({}),
);
const updateContact = mock.fn<(args: unknown) => Promise<void>>(async () => {});
const resolveShopContactMarketId = mock.fn(async () => "UA");

mock.module("../../../app/api/update-contact", {
  namedExports: { updateContact },
});
mock.module("../../../app/repositories/repositories.server", {
  namedExports: {
    customerSyncRepository: {
      getCustomerSyncByCustomerIds,
      createOrUpdateCustomerSync,
    },
  },
});
mock.module("../../../app/services/fetch-contact-market-context.server", {
  namedExports: { resolveShopContactMarketId },
});

const { updateContactService } = await import(
  "../../../app/services/update-contact.service"
);

const run = (data: unknown = payload) =>
  updateContactService(data, "key", 3, "demo.com", 5, "demo.myshopify.com");

const yespoFails = (status?: number) =>
  updateContact.mock.mockImplementationOnce(async () => {
    throw Object.assign(new Error(`HTTP ${status}`), status ? { status } : {});
  });

mock.method(console, "log", () => {});
mock.method(console, "error", () => {});

beforeEach(() => {
  stored = [];
  for (const fn of [
    getCustomerSyncByCustomerIds,
    createOrUpdateCustomerSync,
    updateContact,
    resolveShopContactMarketId,
  ]) {
    fn.mock.resetCalls();
  }
});

test("success: sends the contact and records CustomerSync", async () => {
  await run();

  assert.equal(updateContact.mock.callCount(), 1);
  assert.equal(createOrUpdateCustomerSync.mock.callCount(), 1);
  assert.deepEqual(createOrUpdateCustomerSync.mock.calls[0].arguments[0], {
    customerId: payload.admin_graphql_api_id,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
    shop: { connect: { id: 3 } },
  });
});

for (const status of [429, 500, 503, undefined]) {
  test(`Yespo error with status ${status} is thrown without a marker`, async () => {
    yespoFails(status);

    await assert.rejects(run(), new RegExp(`HTTP ${status}`));

    assert.equal(createOrUpdateCustomerSync.mock.callCount(), 0);
  });
}

for (const status of [400, 401, 409]) {
  test(`Yespo error with status ${status} is not thrown and leaves no marker`, async () => {
    yespoFails(status);

    await run();

    assert.equal(updateContact.mock.callCount(), 1);
    assert.equal(createOrUpdateCustomerSync.mock.callCount(), 0);
  });
}

test("failed marker write is thrown so the job is retried", async () => {
  createOrUpdateCustomerSync.mock.mockImplementationOnce(async () => {
    throw new Error("db down");
  });

  await assert.rejects(run(), /db down/);
});

test("stored CustomerSync is newer: nothing is sent or requested", async () => {
  stored = [{ updatedAt: new Date(STORED.getTime() + 1000) }];

  await run();

  assert.equal(resolveShopContactMarketId.mock.callCount(), 0);
  assert.equal(updateContact.mock.callCount(), 0);
  assert.equal(createOrUpdateCustomerSync.mock.callCount(), 0);
  assert.deepEqual(getCustomerSyncByCustomerIds.mock.calls[0].arguments, [
    3,
    [payload.admin_graphql_api_id],
  ]);
});

for (const [name, rows, updatedAt] of [
  ["same date", [{ updatedAt: STORED }], payload.updated_at],
  ["same date in another offset", [{ updatedAt: STORED }], "2026-01-01T19:00:00-05:00"],
  ["older stored date", [{ updatedAt: new Date(0) }], payload.updated_at],
  ["stored row without a date", [{ updatedAt: null }], payload.updated_at],
  ["no stored row", [], payload.updated_at],
  ["updated_at null", [{ updatedAt: STORED }], null],
  ["updated_at missing", [{ updatedAt: STORED }], undefined],
  ["updated_at invalid", [{ updatedAt: STORED }], "not a date"],
] as const) {
  test(`${name}: the contact is sent`, async () => {
    stored = [...rows];

    await run({ ...payload, updated_at: updatedAt });

    assert.equal(updateContact.mock.callCount(), 1);
    assert.equal(createOrUpdateCustomerSync.mock.callCount(), 1);
  });
}

test("failed CustomerSync read is thrown and nothing is sent", async () => {
  getCustomerSyncByCustomerIds.mock.mockImplementationOnce(async () => {
    throw new Error("db down");
  });

  await assert.rejects(run(), /db down/);

  assert.equal(updateContact.mock.callCount(), 0);
});
