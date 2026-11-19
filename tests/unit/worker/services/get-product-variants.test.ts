import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { GraphQLClient } from "@shopify/graphql-client";
import type { ProductData } from "../../../../app/@types/product";

const { fetchAllProductVariants } =
  await import("../../../../app/worker/services/get-product-variants");

const PRODUCT_ID = "gid://shopify/Product/1";
const variant = (id: string) => ({ id });

function fakeClient(responses: object[]) {
  const request = mock.fn<
    (query: string, options?: unknown) => Promise<unknown>
  >(async () => responses.shift());
  return { client: { request } as unknown as GraphQLClient, request };
}

const product = () =>
  ({
    id: PRODUCT_ID,
    variants: {
      nodes: [variant("v-1")],
      pageInfo: { hasNextPage: true, endCursor: "c1" },
    },
  }) as unknown as ProductData;

const variantsPage = (id: string, hasNextPage: boolean, endCursor: string) => ({
  data: {
    product: {
      variants: { nodes: [variant(id)], pageInfo: { hasNextPage, endCursor } },
    },
  },
});

test("reads every page of variants", async () => {
  const { client, request } = fakeClient([
    variantsPage("v-2", true, "c2"),
    variantsPage("v-3", false, "c3"),
  ]);

  const variants = await fetchAllProductVariants({
    client,
    product: product(),
  });

  assert.deepEqual(
    variants.map((item) => item.id),
    ["v-1", "v-2", "v-3"],
  );
  assert.deepEqual(
    request.mock.calls.map(
      (call) =>
        (call.arguments[1] as { variables: { cursor: string } }).variables
          .cursor,
    ),
    ["c1", "c2"],
  );
});

test("rejects when a later page of variants fails", async () => {
  const { client } = fakeClient([
    variantsPage("v-2", true, "c2"),
    {
      errors: {
        networkStatusCode: 502,
        message: "GraphQL Client: Bad Gateway",
      },
    },
  ]);

  await assert.rejects(
    fetchAllProductVariants({ client, product: product() }),
    /variants of product/,
  );
});

test("rejects a partial page of variants", async () => {
  const { client } = fakeClient([
    {
      ...variantsPage("v-2", false, "c2"),
      errors: {
        message: "GraphQL Client: An error occurred",
        graphQLErrors: [{ message: "Internal error" }],
      },
    },
  ]);

  await assert.rejects(
    fetchAllProductVariants({ client, product: product() }),
    /variants of product/,
  );
});
