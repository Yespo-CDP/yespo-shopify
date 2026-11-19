import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { GraphQLClient } from "@shopify/graphql-client";

const { getProducts, getProductById } = await import(
  "../../../../app/worker/services/get-products"
);

const PRODUCT_ID = "gid://shopify/Product/1";
const collection = (id: string) => ({ id, title: id, handle: id });

function fakeClient(responses: object[]) {
  const request = mock.fn(async (_query: string, _options?: unknown) =>
    responses.shift(),
  );
  return { client: { request } as unknown as GraphQLClient, request };
}

const product = () => ({
  id: PRODUCT_ID,
  collections: {
    nodes: [collection("col-1")],
    pageInfo: { hasNextPage: true, endCursor: "c1" },
  },
  variants: { nodes: [], pageInfo: { hasNextPage: false } },
});

const collectionsPage = {
  data: {
    product: {
      collections: {
        nodes: [collection("col-2")],
        pageInfo: { hasNextPage: false, endCursor: "c2" },
      },
    },
  },
};

const productsPage = () => ({
  data: {
    shop: { currencyCode: "EUR" },
    products: {
      nodes: [product()],
      pageInfo: { hasNextPage: false, endCursor: "p1" },
    },
  },
});

const productByIdPage = () => ({
  data: { shop: { currencyCode: "EUR" }, product: product() },
});

const failure = { errors: { networkStatusCode: 502, message: "Bad Gateway" } };

test("getProducts reads the remaining collections of a product", async () => {
  const { client, request } = fakeClient([productsPage(), collectionsPage]);

  const { products } = await getProducts({ client, count: 50 });

  assert.deepEqual(
    products[0].collections?.nodes.map((node) => node.id),
    ["col-1", "col-2"],
  );
  assert.deepEqual(request.mock.calls[1].arguments[1], {
    variables: { id: PRODUCT_ID, cursor: "c1" },
  });
});

test("getProducts rejects when reading the remaining collections fails", async () => {
  const { client } = fakeClient([productsPage(), failure]);

  await assert.rejects(getProducts({ client, count: 50 }), /collections/);
});

test("getProductById reads the remaining collections of the product", async () => {
  const { client } = fakeClient([productByIdPage(), collectionsPage]);

  const { product } = await getProductById({ client, productId: PRODUCT_ID });

  assert.deepEqual(
    product?.collections?.nodes.map((node) => node.id),
    ["col-1", "col-2"],
  );
});

test("getProductById rejects when reading the remaining collections fails", async () => {
  const { client } = fakeClient([productByIdPage(), failure]);

  await assert.rejects(
    getProductById({ client, productId: PRODUCT_ID }),
    /collections/,
  );
});

test("getProducts rejects when the products query fails", async () => {
  const { client, request } = fakeClient([failure]);

  await assert.rejects(getProducts({ client, count: 50 }), /products/);
  assert.equal(request.mock.callCount(), 1);
});

test("getProducts rejects a partial products response", async () => {
  const { client } = fakeClient([
    {
      ...productsPage(),
      errors: {
        message: "GraphQL Client: An error occurred",
        graphQLErrors: [{ message: "Internal error" }],
      },
    },
  ]);

  await assert.rejects(getProducts({ client, count: 50 }), /products/);
});
