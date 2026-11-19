import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { GraphQLClient } from "@shopify/graphql-client";

const { getCustomers } =
  await import("../../../../app/worker/services/get-customers");

function fakeClient(responses: object[]) {
  const request = mock.fn<
    (query: string, options?: unknown) => Promise<unknown>
  >(async () => responses.shift());
  return { client: { request } as unknown as GraphQLClient, request };
}

const customersPage = () => ({
  data: {
    customers: {
      nodes: [{ id: "gid://shopify/Customer/1" }],
      pageInfo: { hasNextPage: true, endCursor: "c1" },
    },
  },
});

test("returns the customers of a page and the next cursor", async () => {
  const { client, request } = fakeClient([customersPage()]);

  const result = await getCustomers({ client, count: 200, cursor: "c0" });

  assert.deepEqual(result, {
    customers: [{ id: "gid://shopify/Customer/1" }],
    cursor: "c1",
  });
  assert.deepEqual(request.mock.calls[0].arguments[1], {
    variables: { count: 200, cursor: "c0" },
  });
});

test("rejects when the customers query fails", async () => {
  const { client } = fakeClient([
    {
      errors: {
        networkStatusCode: 401,
        message: "GraphQL Client: Unauthorized",
      },
    },
  ]);

  await assert.rejects(getCustomers({ client, count: 200 }), /customers/);
});

test("rejects a partial customers response", async () => {
  const { client } = fakeClient([
    {
      ...customersPage(),
      errors: {
        message: "GraphQL Client: An error occurred",
        graphQLErrors: [
          {
            message: "This app is not approved to use the phoneNumber field.",
            path: ["customers", "nodes", 0, "defaultPhoneNumber"],
          },
        ],
      },
    },
  ]);

  await assert.rejects(getCustomers({ client, count: 200 }), /customers/);
});
