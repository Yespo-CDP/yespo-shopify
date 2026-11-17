import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module("../../../../app/shopify.server", {
  namedExports: { apiVersion: "2026-04" },
});

const { createClient } = await import(
  "../../../../app/worker/services/create-client"
);

test("uses the app Admin API version in the client URL", () => {
  const client = createClient({
    shop: "demo.myshopify.com",
    accessToken: "token",
  });

  assert.equal(
    client.config.url,
    "https://demo.myshopify.com/admin/api/2026-04/graphql.json",
  );
});
