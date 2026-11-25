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

const { updateContact } = await import("../../../app/api/update-contact");

const run = () =>
  updateContact({
    apiKey: "key",
    contactData: { channels: [], externalCustomerId: "7" } as never,
    domain: "demo.com",
    orgId: 5,
  });

mock.method(console, "log", () => {});
mock.method(console, "error", () => {});

beforeEach(() => {
  fetchError = null;
  sendLogEvent.mock.resetCalls();
});

for (const status of [400, 503]) {
  test(`HTTP ${status}: the original error is logged and thrown with its status`, async () => {
    fetchError = new FetchError(`HTTP ${status}`, status);

    await assert.rejects(run(), (error) => error === fetchError);

    assert.equal(sendLogEvent.mock.callCount(), 1);
    const event = sendLogEvent.mock.calls[0].arguments[0];
    assert.equal(event.logLevel, "ERROR");
    assert.equal((event.data as Record<string, unknown>).statusCode, status);
  });
}

test("'Duplicated request' is logged and not thrown", async () => {
  fetchError = new FetchError("HTTP 409: Duplicated request", 409);

  await run();

  assert.equal(sendLogEvent.mock.callCount(), 1);
});
