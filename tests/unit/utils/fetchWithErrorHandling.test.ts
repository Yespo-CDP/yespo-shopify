import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

import { fetchWithErrorHandling } from "../../../app/utils/fetchWithErrorHandling";

mock.method(console, "warn", () => {});

afterEach(() => {
  mock.restoreAll();
  mock.method(console, "warn", () => {});
});

test("passes an AbortSignal and keeps the caller's options", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () =>
    new Response('{"ok":true}', { status: 200 }),
  );

  const result = await fetchWithErrorHandling("https://yespo.test/v1/contact", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });

  assert.deepEqual(result, { responseData: { ok: true }, status: 200 });
  const init = fetchMock.mock.calls[0].arguments[1] as RequestInit;
  assert.ok(init.signal instanceof AbortSignal);
  assert.equal(init.method, "POST");
  assert.deepEqual(init.headers, { "content-type": "application/json" });
  assert.equal(init.body, "{}");
});

test("a timeout is thrown as an error with status 500", async () => {
  mock.method(globalThis, "fetch", async () => {
    throw new DOMException(
      "The operation was aborted due to timeout",
      "TimeoutError",
    );
  });

  await assert.rejects(fetchWithErrorHandling("https://yespo.test/v1/orders"), {
    status: 500,
    message: "The operation was aborted due to timeout",
  });
});

test("each retry after 429 gets a new signal", async () => {
  let call = 0;
  const fetchMock = mock.method(globalThis, "fetch", async () =>
    call++ === 0
      ? new Response("", { status: 429, headers: { "retry-after": "0" } })
      : new Response("{}", { status: 200 }),
  );

  await fetchWithErrorHandling("https://yespo.test/v1/contact");

  assert.equal(fetchMock.mock.callCount(), 2);
  const [first, second] = fetchMock.mock.calls.map(
    (c) => (c.arguments[1] as RequestInit).signal,
  );
  assert.ok(first instanceof AbortSignal);
  assert.ok(second instanceof AbortSignal);
  assert.notEqual(first, second);
});
