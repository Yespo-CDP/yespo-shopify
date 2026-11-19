import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

class FetchError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

let fetchError: FetchError | null = null;
const fetchWithErrorHandling = mock.fn<
  (url: string, options: RequestInit) => Promise<unknown>
>(async () => {
  if (fetchError) throw fetchError;
  return { responseData: "ok", status: 200 };
});
const sendLogEvent = mock.fn<
  (event: Record<string, unknown>) => Promise<void>
>(async () => {});

mock.module("../../../app/utils/fetchWithErrorHandling", {
  namedExports: { fetchWithErrorHandling },
});
mock.module("../../../app/api/send-log-event", {
  namedExports: { sendLogEvent },
});

process.env.API_URL = "https://yespo.test/api/v1";

const { deleteYespoOrder } = await import("../../../app/api/delete-orders");

const run = () =>
  deleteYespoOrder({
    apiKey: "key",
    externalOrderId: "820982911946154508",
    domain: "demo.com",
    orgId: 5,
  });

beforeEach(() => {
  fetchError = null;
  fetchWithErrorHandling.mock.resetCalls();
  sendLogEvent.mock.resetCalls();
});

test("sends DELETE /orders with externalOrderId in the query", async () => {
  await run();

  assert.equal(fetchWithErrorHandling.mock.callCount(), 1);
  const [url, options] = fetchWithErrorHandling.mock.calls[0].arguments;
  assert.equal(url, "https://yespo.test/api/v1/orders?externalOrderId=820982911946154508");
  assert.equal(options.method, "DELETE");
  assert.equal(options.body, undefined);
  assert.equal(sendLogEvent.mock.callCount(), 0);
});

test("HTTP 400 is logged and not thrown", async (t) => {
  t.mock.method(console, "error", () => {});
  fetchError = new FetchError("HTTP 400", 400);

  await run();

  assert.equal(sendLogEvent.mock.callCount(), 1);
  const event = sendLogEvent.mock.calls[0].arguments[0];
  const data = event.data as Record<string, unknown>;
  assert.equal(event.message, "CUSTOM_LOG_DELETE_YESPO_ORDERS_ERROR");
  assert.deepEqual(data.requestBody, { externalOrderId: "820982911946154508" });
  assert.equal(data.statusCode, 400);
});

test("other errors are logged and thrown so the job is retried", async (t) => {
  t.mock.method(console, "error", () => {});
  fetchError = new FetchError("HTTP 500", 500);

  await assert.rejects(run(), /HTTP 500/);

  assert.equal(sendLogEvent.mock.callCount(), 1);
  assert.equal((sendLogEvent.mock.calls[0].arguments[0].data as Record<string, unknown>).statusCode, 500);
});
