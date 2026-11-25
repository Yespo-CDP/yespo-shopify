import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

class FetchError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

let fetchError: FetchError | null = null;
const sendLogEvent = mock.fn<
  (event: Record<string, unknown>) => Promise<void>
>(async () => {});

mock.module("../../../app/utils/fetchWithErrorHandling", {
  namedExports: {
    fetchWithErrorHandling: async () => {
      if (fetchError) throw fetchError;
      return { responseData: { id: 1 }, status: 200 };
    },
  },
});
mock.module("../../../app/api/send-log-event", {
  namedExports: { sendLogEvent },
});

const { createOrders } = await import("../../../app/api/create-orders");

const run = () =>
  createOrders({ apiKey: "key", orders: [], domain: "demo.com", orgId: 5 });

mock.method(console, "error", () => {});

beforeEach(() => {
  fetchError = null;
  sendLogEvent.mock.resetCalls();
});

for (const [message, status] of [
  ["HTTP 400", 400],
  ["HTTP 503", 503],
  ["HTTP 409: Duplicated request", 409],
] as const) {
  test(`${message}: the original error is logged and thrown with its status`, async () => {
    fetchError = new FetchError(message, status);

    await assert.rejects(run(), (error) => error === fetchError);

    assert.equal(sendLogEvent.mock.callCount(), 1);
    const event = sendLogEvent.mock.calls[0].arguments[0];
    assert.equal(event.logLevel, "ERROR");
    assert.equal((event.data as Record<string, unknown>).statusCode, status);
  });
}

test("success returns the Yespo response", async () => {
  assert.deepEqual(await run(), { id: 1 });
  assert.equal(sendLogEvent.mock.callCount(), 0);
});
