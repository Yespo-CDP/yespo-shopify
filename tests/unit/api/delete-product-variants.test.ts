import assert from "node:assert/strict";
import { mock, test } from "node:test";

let responseData: unknown = {};

mock.module("../../../app/utils/fetchWithErrorHandling", {
  namedExports: {
    fetchWithErrorHandling: async () => ({ responseData, status: 207 }),
  },
});
mock.module("../../../app/utils/rate-limiter.server", {
  namedExports: { throttleApiRequest: async () => {} },
});
mock.module("../../../app/api/send-log-event", {
  namedExports: { sendLogEvent: async () => {} },
});

const { deleteProductVariants } = await import(
  "../../../app/api/delete-product-variants"
);

const run = () =>
  deleteProductVariants({
    apiKey: "key",
    siteId: "site",
    externalVariantIds: ["1", "2"],
    domain: "demo.com",
  });

test("returns only variant ids Yespo accepted", async () => {
  responseData = {
    summary: { received: 2, accepted: 1, rejected: 1 },
    items: [
      { productId: "1", status: "accepted" },
      { productId: "2", status: "rejected", code: "INVALID_updatedDate" },
    ],
  };

  assert.deepEqual(await run(), ["1"]);
});

test("returns nothing when the response has no items or summary", async () => {
  responseData = {};

  assert.deepEqual(await run(), []);
});
