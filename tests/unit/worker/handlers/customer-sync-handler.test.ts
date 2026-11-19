import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const customers = ["a", "b", "c"].map((name, index) => ({
  id: `gid://shopify/Customer/${index + 1}`,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
  defaultEmailAddress: { emailAddress: `${name}@example.com` },
}));

const createOrUpdateCustomerSync = mock.fn(async (_data: unknown) => ({}));
let updateContacts = mock.fn(async (_args: unknown): Promise<unknown> => ({}));

mock.module("../../../../app/repositories/repositories.server", {
  namedExports: {
    shopRepository: {
      getShop: async () => ({ domain: "demo.com", isContactSyncEnabled: true }),
    },
    customerSyncRepository: {
      getCustomerSyncByCustomerIds: async () => [],
      createOrUpdateCustomerSync,
    },
    customerSyncLogRepository: { createOrUpdateCustomerSyncLog: async () => ({}) },
  },
});
mock.module("../../../../app/api/update-contacts", {
  namedExports: { updateContacts: (args: unknown) => updateContacts(args) },
});
mock.module("../../../../app/worker/services/create-client", {
  namedExports: { createClient: () => ({}) },
});
mock.module("../../../../app/worker/services/get-customers", {
  namedExports: { getCustomers: async () => ({ customers, cursor: null }) },
});
mock.module("../../../../app/worker/services/get-customers-count", {
  namedExports: { getCustomersCount: async () => customers.length },
});
mock.module("../../../../app/services/fetch-contact-market-context.server", {
  namedExports: { fetchContactMarketContext: async () => null },
});
mock.module("../../../../app/api/send-log-event", {
  namedExports: { sendLogEvent: async () => {} },
});

const { customerSyncHandler } = await import(
  "../../../../app/worker/handlers/customer-sync-handler"
);

const markedIds = () =>
  createOrUpdateCustomerSync.mock.calls.map(
    (call) => (call.arguments[0] as { customerId: string }).customerId,
  );

beforeEach(() => {
  createOrUpdateCustomerSync.mock.resetCalls();
});

test("no sync marker when Yespo request throws", async () => {
  updateContacts = mock.fn(async () => {
    throw new Error("502");
  });

  await customerSyncHandler("demo.myshopify.com", "token", "key", 1);

  assert.equal(updateContacts.mock.callCount(), 1);
  assert.equal(createOrUpdateCustomerSync.mock.callCount(), 0);
});

test("rejected contact (single object) matched by email gets no marker", async () => {
  updateContacts = mock.fn(async () => ({
    failedContacts: {
      channels: { type: "email", value: " B@Example.com " },
      error: "invalid",
    },
  }));

  await customerSyncHandler("demo.myshopify.com", "token", "key", 1);

  assert.deepEqual(markedIds(), [
    "gid://shopify/Customer/1",
    "gid://shopify/Customer/3",
  ]);
});
