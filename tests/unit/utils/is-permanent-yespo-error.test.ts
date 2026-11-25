import assert from "node:assert/strict";
import { test } from "node:test";
import { isPermanentYespoError } from "../../../app/utils/is-permanent-yespo-error";

const withStatus = (status: unknown) =>
  Object.assign(new Error("failed"), { status });

for (const status of [400, 401, 404, 409, 499]) {
  test(`status ${status} is permanent`, () => {
    assert.equal(isPermanentYespoError(withStatus(status)), true);
  });
}

for (const status of [399, 429, 500, 503, undefined, "400"]) {
  test(`status ${JSON.stringify(status)} is not permanent`, () => {
    assert.equal(isPermanentYespoError(withStatus(status)), false);
  });
}

test("errors without a status are not permanent", () => {
  assert.equal(isPermanentYespoError(new TypeError("x")), false);
  assert.equal(isPermanentYespoError(Object.assign(new Error("db"), { code: "P1001" })), false);
  assert.equal(isPermanentYespoError(null), false);
  assert.equal(isPermanentYespoError(undefined), false);
});
