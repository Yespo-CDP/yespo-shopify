import assert from "node:assert/strict";
import crypto from "node:crypto";
import { beforeEach, mock, test } from "node:test";

const SECRET = "test-secret";
process.env.SHOPIFY_API_SECRET = SECRET;

const SHOP = "demo.myshopify.com";

let webhook = { topic: "", payload: {} as unknown };
let store: Record<string, unknown> = {};

const deleteShop = mock.fn(async (_shop: string) => {});
const deleteCustomer = mock.fn(async (_customerId: string) => {});
const deleteContactService = mock.fn(async (..._args: unknown[]) => {});

mock.module("../../../app/shopify.server", {
  namedExports: {
    authenticate: {
      webhook: async () => ({ shop: SHOP, webhookId: "wh-1", ...webhook }),
    },
  },
});

mock.module("../../../app/repositories/repositories.server", {
  namedExports: {
    shopRepository: { getShop: async () => store, deleteShop },
    customerRepository: { deleteCustomer },
    gdprCustomerDataRepository: { createGdprCustomerDataRequest: async () => {} },
  },
});

mock.module("../../../app/services/delete-contact.service", {
  namedExports: { deleteContactService },
});

const { action } = await import("../../../app/routes/webhooks.app.gdpr");

const send = (topic: string, payload: unknown) => {
  webhook = { topic, payload };
  const body = JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", SECRET).update(body).digest("base64");
  return action({
    request: new Request("https://app.example/webhooks/app/gdpr", {
      method: "POST",
      headers: { "x-shopify-hmac-sha256": hmac },
      body,
    }),
  } as Parameters<typeof action>[0]);
};

beforeEach(() => {
  deleteShop.mock.resetCalls();
  deleteCustomer.mock.resetCalls();
  deleteContactService.mock.resetCalls();
});

test("SHOP_REDACT deletes the shop even without an API key", async () => {
  store = { id: 1, shopUrl: SHOP, apiKey: null, isContactSyncEnabled: false };

  const response = await send("SHOP_REDACT", { shop_domain: SHOP });

  assert.equal(response.status, 200);
  assert.deepEqual(deleteShop.mock.calls[0].arguments, [SHOP]);
});

test("CUSTOMERS_REDACT without an API key deletes only the local customer", async () => {
  store = { id: 1, shopUrl: SHOP, apiKey: null, isContactSyncEnabled: true };

  const response = await send("CUSTOMERS_REDACT", { customer: { id: 123 } });

  assert.equal(response.status, 200);
  assert.deepEqual(deleteCustomer.mock.calls[0].arguments, ["123"]);
  assert.equal(deleteContactService.mock.callCount(), 0);
});

test("CUSTOMERS_REDACT with an API key deletes the Yespo contact and the local customer", async () => {
  store = {
    id: 1,
    shopUrl: SHOP,
    apiKey: "key",
    isContactSyncEnabled: true,
    domain: SHOP,
    orgId: 5,
  };

  const response = await send("CUSTOMERS_REDACT", { customer: { id: 456 } });

  assert.equal(response.status, 200);
  assert.deepEqual(deleteContactService.mock.calls[0].arguments, [
    "456",
    "key",
    true,
    SHOP,
    5,
  ]);
  assert.deepEqual(deleteCustomer.mock.calls[0].arguments, ["456"]);
});
