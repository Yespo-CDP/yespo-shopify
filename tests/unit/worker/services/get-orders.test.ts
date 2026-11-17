import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { GraphQLClient } from "@shopify/graphql-client";

const { getOrders } = await import("../../../../app/worker/services/get-orders");

const ORDER_ID = "gid://shopify/Order/1";
const item = (id: string) => ({ id, name: id, quantity: 1 });

function fakeClient(responses: object[]) {
  const request = mock.fn(async (_query: string, _options?: unknown) =>
    responses.shift(),
  );
  return { client: { request } as unknown as GraphQLClient, request };
}

const firstPage = () => ({
  data: {
    orders: {
      nodes: [
        {
          id: ORDER_ID,
          lineItems: {
            nodes: [item("li-1")],
            pageInfo: { hasNextPage: true, endCursor: "c1" },
          },
        },
      ],
      pageInfo: { hasNextPage: false, endCursor: "o1" },
    },
  },
});

test("reads the remaining line items of an order", async () => {
  const { client, request } = fakeClient([
    firstPage(),
    {
      data: {
        order: {
          lineItems: {
            nodes: [item("li-2")],
            pageInfo: { hasNextPage: true, endCursor: "c2" },
          },
        },
      },
    },
    {
      data: {
        order: {
          lineItems: {
            nodes: [item("li-3")],
            pageInfo: { hasNextPage: false, endCursor: "c3" },
          },
        },
      },
    },
  ]);

  const { orders } = await getOrders({ client, count: 150 });

  assert.deepEqual(
    orders[0].lineItems.nodes.map((node) => node.id),
    ["li-1", "li-2", "li-3"],
  );
  assert.deepEqual(
    request.mock.calls.slice(1).map((call) => call.arguments[1]),
    [
      { variables: { id: ORDER_ID, cursor: "c1" } },
      { variables: { id: ORDER_ID, cursor: "c2" } },
    ],
  );
});

test("rejects when reading the remaining line items fails", async () => {
  const { client } = fakeClient([
    firstPage(),
    { errors: { networkStatusCode: 502, message: "Bad Gateway" } },
  ]);

  await assert.rejects(getOrders({ client, count: 150 }), /line items/);
});
