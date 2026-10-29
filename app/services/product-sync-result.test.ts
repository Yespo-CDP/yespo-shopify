import assert from "node:assert/strict";
import test from "node:test";

import { productIdsYespoAccepted } from "./product-sync-result";

const sent = ["50528684867758"];

test("only an explicit accepted item clears the failure flag", () => {
  const accepted = productIdsYespoAccepted(sent, [
    {
      productId: "50528684867758",
      status: "accepted",
    },
  ]);

  assert.deepEqual([...accepted], sent);
});

test("a rejected item stays failed", () => {
  const accepted = productIdsYespoAccepted(sent, [
    {
      productId: "50528684867758",
      status: "rejected",
      code: "INVALID_URL",
    },
  ]);

  assert.equal(accepted.size, 0);
});

test("a response that does not name the variant stays failed", () => {
  const accepted = productIdsYespoAccepted(sent, {
    status: "rejected",
    code: "INVALID_URL",
    message: "imageUrl is required for create",
  });

  assert.equal(accepted.size, 0);
});

test("a numeric productId still matches the sent id", () => {
  const accepted = productIdsYespoAccepted(sent, [
    { productId: 50528684867758, status: "accepted" },
  ]);

  assert.deepEqual([...accepted], sent);
});

test("an empty body with every item counted as accepted is accepted", () => {
  const accepted = productIdsYespoAccepted(sent, undefined, {
    received: 1,
    accepted: 1,
    rejected: 0,
  });

  assert.deepEqual([...accepted], sent);
});

test("an empty body that reports rejections stays failed", () => {
  const accepted = productIdsYespoAccepted(sent, [], {
    received: 1,
    accepted: 0,
    rejected: 1,
  });

  assert.equal(accepted.size, 0);
});
