import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { PurchasedItemsEvent } from "../../../app/@types/purchasedItems";

let fetchResult: () => Promise<unknown> = async () => ({ responseData: {}, status: 200 });

mock.module("../../../app/utils/fetchWithErrorHandling", {
  namedExports: { fetchWithErrorHandling: async () => fetchResult() },
});
mock.module("../../../app/api/send-log-event", {
  namedExports: { sendLogEvent: async () => {} },
});

const { sendPurchasedItemsEvent } = await import(
  "../../../app/api/send-purchased-items-event"
);

const run = () =>
  sendPurchasedItemsEvent({
    apiKey: "key",
    purchasedItemsData: {} as PurchasedItemsEvent,
    domain: "demo.com",
  });

test("returns true when the tracker accepts the event", async () => {
  assert.equal(await run(), true);
});

test("returns false when the tracker request fails", async () => {
  fetchResult = async () => {
    throw Object.assign(new Error("HTTP 500"), { status: 500 });
  };

  assert.equal(await run(), false);
});
