import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { GraphQLClient } from "@shopify/graphql-client";

const { fetchShopMarketsConfig } = await import(
  "../../../../app/worker/services/fetch-shop-markets-config"
);

const MARKET_ID = "gid://shopify/Market/1";

function fakeClient(responses: object[]) {
  const request = mock.fn(async (_query: string, _options?: unknown) =>
    responses.shift(),
  );
  return { client: { request } as unknown as GraphQLClient, request };
}

const firstPage = () => ({
  data: {
    markets: {
      nodes: [
        {
          id: MARKET_ID,
          name: "Europe",
          handle: "europe",
          enabled: true,
          regions: {
            nodes: [{ code: "DE" }],
            pageInfo: { hasNextPage: true, endCursor: "c1" },
          },
        },
      ],
    },
  },
});

test("reads the remaining countries of a market", async () => {
  const { client, request } = fakeClient([
    firstPage(),
    {
      data: {
        market: {
          regions: {
            nodes: [{ code: "FR" }, { code: "PL" }],
            pageInfo: { hasNextPage: false, endCursor: "c2" },
          },
        },
      },
    },
  ]);

  const config = await fetchShopMarketsConfig({ client });

  assert.deepEqual(config.markets[0].countries, ["DE", "FR", "PL"]);
  assert.deepEqual(config.countries, ["DE", "FR", "PL"]);
  assert.deepEqual(request.mock.calls[1].arguments[1], {
    variables: { id: MARKET_ID, cursor: "c1" },
  });
});

test("rejects when reading the remaining countries fails", async () => {
  const { client } = fakeClient([
    firstPage(),
    { errors: { message: "GraphQL Client: An error occurred", graphQLErrors: [{ message: "Internal error" }] } },
  ]);

  await assert.rejects(fetchShopMarketsConfig({ client }), /countries/);
});

test("rejects when the markets query fails", async () => {
  const { client, request } = fakeClient([
    { errors: { networkStatusCode: 502, message: "GraphQL Client: Bad Gateway" } },
  ]);

  await assert.rejects(fetchShopMarketsConfig({ client }), /markets/);
  assert.equal(request.mock.callCount(), 1);
});

test("rejects a partial markets response", async () => {
  const { client } = fakeClient([
    {
      ...firstPage(),
      errors: {
        message: "GraphQL Client: An error occurred",
        graphQLErrors: [{ message: "Internal error", path: ["markets"] }],
      },
    },
  ]);

  await assert.rejects(fetchShopMarketsConfig({ client }), /markets/);
});
