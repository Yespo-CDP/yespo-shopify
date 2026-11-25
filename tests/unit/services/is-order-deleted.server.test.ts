import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import { inspect } from "node:util";

const SHOP = "demo.myshopify.com";
const ORDER_GID = "gid://shopify/Order/1";

let token: string | null = "offline-token";
const tokenManager = { getAccessToken: async () => token };
const createOfflineTokenManager = mock.fn<(shop: string) => unknown>(() => tokenManager);
let response: unknown;
const request = mock.fn<(...args: unknown[]) => Promise<unknown>>(async () => {
  if (response instanceof Error) throw response;
  return response;
});
const createClient = mock.fn<(params: unknown) => unknown>(() => ({ request }));

mock.module("../../../app/worker/services/offline-token-manager", {
  namedExports: { createOfflineTokenManager },
});
mock.module("../../../app/worker/services/create-client", {
  namedExports: { createClient },
});

const { isOrderDeleted } = await import(
  "../../../app/services/is-order-deleted.server"
);

const logError = mock.method(console, "error", () => {});

const run = () => isOrderDeleted({ shopUrl: SHOP, orderGid: ORDER_GID });

// Same shape as `@shopify/graphql-client`, which keeps the raw response in `errors`.
const errors = {
  networkStatusCode: 200,
  message: "GraphQL Client: An error occurred while fetching from the API",
  graphQLErrors: [
    { message: "Access denied for order field.", extensions: { code: "ACCESS_DENIED" } },
  ],
  response: new Response("raw body", { headers: { "x-secret": "secret-header" } }),
};

beforeEach(() => {
  token = "offline-token";
  response = { data: { order: { id: ORDER_GID } } };
  for (const fn of [createOfflineTokenManager, createClient, request]) {
    fn.mock.resetCalls();
  }
  logError.mock.resetCalls();
});

test("asks Shopify for the order with the shop's offline token manager", async () => {
  await run();

  assert.deepEqual(createOfflineTokenManager.mock.calls[0]?.arguments, [SHOP]);
  assert.deepEqual(createClient.mock.calls[0]?.arguments, [
    { shop: SHOP, accessToken: "offline-token", tokenManager },
  ]);
  assert.equal(request.mock.callCount(), 1);
  const [query, options] = request.mock.calls[0].arguments;
  assert.match(
    String(query).replace(/\s+/g, " "),
    /query orderExists\(\$id: ID!\) \{ order\(id: \$id\) \{ id \} \}/,
  );
  assert.deepEqual(options, { variables: { id: ORDER_GID } });
});

test("existing order is not deleted", async () => {
  assert.equal(await run(), false);
  assert.equal(logError.mock.callCount(), 0);
});

test("null order without errors is deleted", async () => {
  response = { data: { order: null } };

  assert.equal(await run(), true);
  assert.equal(logError.mock.callCount(), 0);
});

for (const [name, failure] of [
  ["errors with a null order", { data: { order: null }, errors }],
  ["errors without data", { errors }],
  ["a thrown error", new Error("network down")],
  ["no data", {}],
  ["data without the order", { data: {} }],
] as const) {
  test(`not deleted when the check failed: ${name}`, async () => {
    response = failure;

    assert.equal(await run(), false);
    assert.equal(request.mock.callCount(), 1);
    assert.equal(logError.mock.callCount(), 1);
    const logged = inspect(logError.mock.calls[0].arguments, { depth: null });
    assert.match(logged, /demo\.myshopify\.com/);
    assert.doesNotMatch(logged, /offline-token|secret-header|raw body/);
  });
}

test("the GraphQL error is in the log", async () => {
  response = { errors };

  await run();

  assert.match(
    logError.mock.calls[0].arguments.map(String).join(" "),
    /ACCESS_DENIED/,
  );
});

test("not deleted and no request without an offline token", async () => {
  token = null;

  assert.equal(await run(), false);
  assert.equal(createClient.mock.callCount(), 0);
  assert.equal(request.mock.callCount(), 0);
});

for (const orderGid of [undefined, ""]) {
  test(`not deleted and no request when the order id is ${JSON.stringify(orderGid)}`, async () => {
    assert.equal(await isOrderDeleted({ shopUrl: SHOP, orderGid }), false);
    assert.equal(request.mock.callCount(), 0);
    assert.equal(logError.mock.callCount(), 1);
  });
}
