import assert from "node:assert/strict";
import test from "node:test";

import { yespoProductAction } from "../../../../app/worker/services/yespo-product-action";

test("a variant Yespo has not accepted yet is created", () => {
  assert.equal(yespoProductAction(null), "create");
  assert.equal(yespoProductAction({ syncFailed: true }), "create");
});

test("a variant Yespo already accepted is updated", () => {
  assert.equal(yespoProductAction({ syncFailed: false }), "update");
});
