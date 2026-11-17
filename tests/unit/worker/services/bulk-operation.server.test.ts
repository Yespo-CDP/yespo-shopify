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

const completedWith = (objectCount?: string | null) =>
  mock.fn(async () => ({
    data: {
      bulkOperation: { id: "A", status: "COMPLETED", url: null, objectCount },
    },
  }));

test("treats COMPLETED without url and no objects as an empty result", async () => {
  const result = await waitForBulkOperation({
    client: { request: completedWith("0") } as never,
    bulkOperationId: "A",
  });

  assert.deepEqual(result, { url: null, objectCount: 0 });
});

test("fails when COMPLETED has no url but objects were processed", async () => {
  for (const objectCount of ["5", "not-a-number", null, undefined]) {
    await assert.rejects(
      waitForBulkOperation({
        client: { request: completedWith(objectCount) } as never,
        bulkOperationId: "A",
      }),
      /without download url/,
    );
  }
});
