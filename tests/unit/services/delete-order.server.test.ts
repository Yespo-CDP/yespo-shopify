import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const calls: string[] = [];
const deleteYespoOrder = mock.fn<
  (args: Record<string, unknown>) => Promise<void>
>(async () => {
  calls.push("yespo");
});
const deleteOrderSync = mock.fn<
  (shopId: number, orderId: string) => Promise<number>
>(async () => {
  calls.push("orderSync");
  return 1;
});

mock.module("../../../app/api/delete-orders", {
  namedExports: { deleteYespoOrder },
});
mock.module("../../../app/repositories/repositories.server", {
  namedExports: { orderSyncRepository: { deleteOrderSync } },
});

const { deleteOrderService } = await import(
  "../../../app/services/delete-order.server"
);

const shop = {
  id: 3,
  apiKey: "key",
  domain: "demo.com",
  shopUrl: "demo.myshopify.com",
  orgId: 5,
} as unknown as Parameters<typeof deleteOrderService>[1];

beforeEach(() => {
  calls.length = 0;
  deleteYespoOrder.mock.resetCalls();
  deleteOrderSync.mock.resetCalls();
});

test("deletes the order in Yespo, then its OrderSync record by GID", async () => {
  await deleteOrderService("820982911946154508", shop);

  assert.deepEqual(calls, ["yespo", "orderSync"]);
  assert.deepEqual(deleteYespoOrder.mock.calls[0].arguments, [
    { apiKey: "key", externalOrderId: "820982911946154508", domain: "demo.com", orgId: 5 },
  ]);
  assert.deepEqual(deleteOrderSync.mock.calls[0].arguments, [
    3,
    "gid://shopify/Order/820982911946154508",
  ]);
});

test("Yespo error is thrown and the OrderSync record is kept", async () => {
  deleteYespoOrder.mock.mockImplementationOnce(async () => {
    throw new Error("HTTP 503");
  });

  await assert.rejects(deleteOrderService("1", shop), /HTTP 503/);

  assert.equal(deleteOrderSync.mock.callCount(), 0);
});
