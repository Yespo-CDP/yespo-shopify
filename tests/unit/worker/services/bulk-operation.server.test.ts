import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module("../../../../app/api/send-log-event", {
  namedExports: { sendLogEvent: async () => {} },
});

const { waitForBulkOperation } = await import(
  "../../../../app/worker/services/bulk-operation.server"
);

test("polls its own bulk operation by id and returns its url", async () => {
  const request = mock.fn(
    async (query: string, options?: { variables?: { id?: string } }) => {
      assert.match(query, /bulkOperation\(id: \$id\)/);
      assert.equal(options?.variables?.id, "A");
      return {
        data: {
          bulkOperation: { id: "A", status: "COMPLETED", url: "https://a" },
        },
      };
    },
  );

  const result = await waitForBulkOperation({
    client: { request } as never,
    bulkOperationId: "A",
  });

  assert.equal(result.url, "https://a");
  assert.equal(request.mock.callCount(), 1);
});
