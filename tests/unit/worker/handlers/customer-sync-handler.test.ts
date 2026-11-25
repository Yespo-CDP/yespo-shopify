import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const createCustomer = (id: number, email?: string, phone?: string) => ({
  id: `gid://shopify/Customer/${id}`,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
  defaultEmailAddress: email ? { emailAddress: email } : null,
  defaultPhoneNumber: phone ? { phoneNumber: phone } : null,
});

const emailCustomers = [
  createCustomer(1, "a@example.com"),
  createCustomer(2, "b@example.com"),
  createCustomer(3, "c@example.com"),
];
const mixedCustomers = [
  createCustomer(1, "a@example.com"),
  createCustomer(2, undefined, "+380501112233"),
  createCustomer(3),
  createCustomer(4, "d@example.com", "+380504445566"),
  createCustomer(5),
];

let pages = [emailCustomers];

const createOrUpdateCustomerSync = mock.fn(async (_data: unknown) => ({}));
const createOrUpdateCustomerSyncLog = mock.fn<
  (data: unknown) => Promise<object>
>(async () => ({}));
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
    customerSyncLogRepository: { createOrUpdateCustomerSyncLog },
  },
});
mock.module("../../../../app/api/update-contacts", {
  namedExports: { updateContacts: (args: unknown) => updateContacts(args) },
});
mock.module("../../../../app/worker/services/create-client", {
  namedExports: { createClient: () => ({}) },
});
mock.module("../../../../app/worker/services/get-customers", {
  namedExports: {
    getCustomers: async ({ cursor }: { cursor?: string | null }) => {
      const page = Number(cursor ?? 0);
      return {
        customers: pages[page],
        cursor: page + 1 < pages.length ? String(page + 1) : null,
      };
    },
  },
});
mock.module("../../../../app/worker/services/get-customers-count", {
  namedExports: { getCustomersCount: async () => pages.flat().length },
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

const markedNumbers = () =>
  markedIds().map((id) => Number(id.split("/").pop()));

const syncWith = async (failedContacts: unknown) => {
  updateContacts = mock.fn(async () => ({ failedContacts }));
  await customerSyncHandler("demo.myshopify.com", "token", "key", 1);
};

const email = (value?: string) => ({ type: "email", value });
const sms = (value?: string) => ({ type: "sms", value });

beforeEach(() => {
  pages = [emailCustomers];
  createOrUpdateCustomerSync.mock.resetCalls();
  createOrUpdateCustomerSyncLog.mock.resetCalls();
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

test("nothing rejected: every contact gets a marker", async () => {
  pages = [mixedCustomers];

  for (const failedContacts of [undefined, [], ""]) {
    createOrUpdateCustomerSync.mock.resetCalls();
    await syncWith(failedContacts);

    assert.deepEqual(markedNumbers(), [1, 2, 3, 4, 5]);
  }
});

test("rejected phone-only contact is matched by digits", async () => {
  pages = [mixedCustomers];

  await syncWith({ channels: sms("38 (050) 111-22-33") });

  assert.deepEqual(markedNumbers(), [1, 3, 4, 5]);
});

test("rejected contact returned without its email is matched by phone", async () => {
  pages = [mixedCustomers];

  await syncWith([{ channels: [email(), sms("+380504445566")] }]);

  assert.deepEqual(markedNumbers(), [1, 2, 3, 5]);
});

test("rejected contact without channels: no marker for contacts without channels", async () => {
  pages = [mixedCustomers];

  for (const channels of [undefined, [], sms(), [email(" "), sms("")]]) {
    createOrUpdateCustomerSync.mock.resetCalls();
    await syncWith({ channels });

    assert.deepEqual(markedNumbers(), [1, 2, 4]);
  }
});

test("rejected contact without channels: no marker in the chunk when all have channels", async () => {
  await syncWith({ error: "invalid" });

  assert.deepEqual(markedNumbers(), []);
});

test("unmatched email falls back to phone", async () => {
  pages = [mixedCustomers];

  await syncWith([
    { channels: [email("other@example.com"), sms("380501112233")] },
  ]);

  assert.deepEqual(markedNumbers(), [1, 3, 4, 5]);
});

test("matched email: phone of the same rejected contact is ignored", async () => {
  pages = [mixedCustomers];

  await syncWith([
    { channels: [sms("+380501112233"), email("D@example.com")] },
  ]);

  assert.deepEqual(markedNumbers(), [1, 2, 3, 5]);
});

test("unmatched rejected contact: no marker in its chunk only", async () => {
  pages = [mixedCustomers, [createCustomer(6, "f@example.com")]];
  const responses = [
    {
      failedContacts: [
        { channels: [] },
        { channels: [email("other@example.com"), sms("+380000000000")] },
      ],
    },
    {},
  ];
  updateContacts = mock.fn(async () => responses.shift());

  await customerSyncHandler("demo.myshopify.com", "token", "key", 1);

  assert.deepEqual(markedNumbers(), [6]);
});

test("phone without digits matches nothing", async () => {
  pages = [[...mixedCustomers, createCustomer(6, undefined, "n/a")]];

  await syncWith([{ channels: sms("n/a") }]);

  assert.deepEqual(markedNumbers(), []);
});

test("same email or phone in several contacts: none of them gets a marker", async () => {
  pages = [
    [
      ...mixedCustomers,
      createCustomer(6, undefined, "380501112233"),
      createCustomer(7, "A@example.com"),
    ],
  ];

  await syncWith([
    { channels: sms("+380501112233") },
    { channels: email("a@example.com") },
  ]);

  assert.deepEqual(markedNumbers(), [3, 4, 5]);
});

test("more rejected without channels than sent: no marker in the chunk", async () => {
  pages = [mixedCustomers.slice(0, 3)];

  await syncWith([{ channels: [] }, { channels: [] }]);

  assert.deepEqual(markedNumbers(), []);
});

test("more rejected with the same phone than matched: no marker in the chunk", async () => {
  pages = [
    [
      ...mixedCustomers.slice(0, 2),
      createCustomer(6, undefined, "050 111 22 33"),
    ],
  ];

  await syncWith([
    { channels: sms("380501112233") },
    { channels: sms("380501112233") },
  ]);

  assert.deepEqual(markedNumbers(), []);
});

test("rejected contact without channels also matches a phone without digits", async () => {
  pages = [
    [
      createCustomer(1, "a@example.com"),
      createCustomer(3),
      createCustomer(6, undefined, "n/a"),
    ],
  ];

  await syncWith({ channels: [] });

  assert.deepEqual(markedNumbers(), [1]);
});

test("errorMessage: no marker in the chunk, chunk counted as failed, sync goes on", async (t) => {
  pages = [mixedCustomers, [createCustomer(6, "f@example.com")]];
  const responses = [
    { errorMessage: "limit", failedContacts: [{ channels: email("a@example.com") }] },
    {},
  ];
  updateContacts = mock.fn(async () => responses.shift());
  const consoleError = t.mock.method(console, "error", () => {});

  await customerSyncHandler("demo.myshopify.com", "token", "key", 1);

  assert.deepEqual(markedNumbers(), [6]);
  const { status, failedCount, syncedCount } =
    createOrUpdateCustomerSyncLog.mock.calls.at(-1)?.arguments[0] as {
      status: string;
      failedCount: number;
      syncedCount: number;
    };
  assert.deepEqual(
    { status, failedCount, syncedCount },
    { status: "COMPLETE", failedCount: 5, syncedCount: 1 },
  );

  assert.equal(consoleError.mock.callCount(), 1);
  const logged = JSON.stringify(consoleError.mock.calls[0].arguments);
  assert.match(logged, /limit/);
  assert.doesNotMatch(logged, /example\.com|380501112233/);
});
