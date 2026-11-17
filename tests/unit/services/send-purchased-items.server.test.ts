import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import type { Shop } from "../../../app/@types/shop";

let eventData: unknown = null;
let eventResult: () => Promise<boolean> = async () => true;

const sendPurchasedItemsEvent = mock.fn(async (_args: unknown) => eventResult());

mock.module("../../../app/repositories/repositories.server", {
  namedExports: { eventDataRepository: { getEventData: async () => eventData } },
});
mock.module("../../../app/api/send-purchased-items-event", {
  namedExports: { sendPurchasedItemsEvent },
});

const { sendPurchasedItemsService } = await import(
  "../../../app/services/send-purchased-items.server"
);

const shop = { id: 1, apiKey: "key", siteId: "site", domain: "demo.com", orgId: 5 } as unknown as Shop;
const payload = {
  id: 10,
  cart_token: "cart-1",
  note_attributes: [],
  customer: null,
  currency: "USD",
  line_items: [{ variant_id: 2, price: "5.00", quantity: 1 }],
};

beforeEach(() => {
  eventData = { sc: "sc-1", marketId: null };
  eventResult = async () => true;
  sendPurchasedItemsEvent.mock.resetCalls();
});

test("returns false without a cart token", async () => {
  assert.equal(await sendPurchasedItemsService({ ...payload, cart_token: null }, shop), false);
  assert.equal(sendPurchasedItemsEvent.mock.callCount(), 0);
});

test("returns false without event data for the cart", async () => {
  eventData = null;

  assert.equal(await sendPurchasedItemsService(payload, shop), false);
  assert.equal(sendPurchasedItemsEvent.mock.callCount(), 0);
});

test("returns false when sending the event throws", async () => {
  eventResult = async () => {
    throw new Error("boom");
  };

  assert.equal(await sendPurchasedItemsService(payload, shop), false);
});

test("returns false when the event was not accepted", async () => {
  eventResult = async () => false;

  assert.equal(await sendPurchasedItemsService(payload, shop), false);
});

test("returns true after the event is sent", async () => {
  assert.equal(await sendPurchasedItemsService(payload, shop), true);
  assert.equal(sendPurchasedItemsEvent.mock.callCount(), 1);
});
