import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { test } from "node:test";

import {
  createShopKey,
  isValidSignature,
} from "../../../app/services/event-data-signature.server";

const ENV_KEY = randomBytes(32);
const GID = "gid://shopify/Shop/548380009";

const withEnvKey = (value: string | undefined, fn: () => void) => {
  const previous = process.env.SHOP_ENCRYPTION_KEY;
  if (value === undefined) delete process.env.SHOP_ENCRYPTION_KEY;
  else process.env.SHOP_ENCRYPTION_KEY = value;
  try {
    fn();
  } finally {
    if (previous === undefined) delete process.env.SHOP_ENCRYPTION_KEY;
    else process.env.SHOP_ENCRYPTION_KEY = previous;
  }
};

test("createShopKey: HMAC-SHA256 hex of the numeric shop id, keyed with the env bytes", () => {
  withEnvKey(ENV_KEY.toString("base64"), () => {
    const expected = createHmac("sha256", ENV_KEY).update("548380009").digest("hex");
    assert.equal(createShopKey(GID), expected);
    assert.notEqual(createShopKey("gid://shopify/Shop/548380010"), expected);
  });
});

for (const [label, value] of [
  ["missing", undefined],
  ["empty", ""],
  ["31 bytes", randomBytes(31).toString("base64")],
  ["33 bytes", randomBytes(33).toString("base64")],
  ["not base64", "!!!!"],
  ["hex instead of base64", randomBytes(32).toString("hex")],
] as const) {
  test(`createShopKey throws when SHOP_ENCRYPTION_KEY is ${label}`, () => {
    withEnvKey(value, () => {
      assert.throws(() => createShopKey(GID), /SHOP_ENCRYPTION_KEY/);
    });
  });
}

test("createShopKey throws when the shop GID has no numeric id", () => {
  withEnvKey(ENV_KEY.toString("base64"), () => {
    for (const gid of ["", "gid://shopify/Shop/", "gid://shopify/Shop/12a"]) {
      assert.throws(() => createShopKey(gid), /numeric shop id/);
    }
  });
});

// The example from https://shopify.dev/docs/api/liquid/filters/hmac_sha256
const VECTOR = "8e0d5d65cff1242a4af66c8f4a32854fd5fb80edcc8aabe9b302b29c7c71dc20";

test("isValidSignature matches the Liquid hmac_sha256 example", () => {
  assert.equal(isValidSignature("Polyjuice", VECTOR, "Polina"), true);
  assert.equal(isValidSignature("Polyjuice ", VECTOR, "Polina"), false);
  assert.equal(isValidSignature("Polyjuice", VECTOR, "Polin"), false);
});

test("isValidSignature uses a hex key as a string, like Liquid, and signs UTF-8", () => {
  const key = randomBytes(32).toString("hex");
  const data = '{"firstName":"Олена \\"O\'Neil\\" \\u003cb\\u003e 😀\u2028"}';
  const sign = (hmacKey: string | Buffer) =>
    createHmac("sha256", hmacKey).update(data, "utf8").digest("hex");

  assert.equal(isValidSignature(data, sign(key), key), true);
  assert.equal(isValidSignature(data, sign(Buffer.from(key, "hex")), key), false);
});

test("isValidSignature rejects malformed input without throwing", () => {
  for (const signature of [
    undefined,
    null,
    "",
    VECTOR.slice(0, 63),
    `${VECTOR}0`,
    `${VECTOR}\n`,
    VECTOR.toUpperCase(),
    "z".repeat(64),
    "é".repeat(64),
    [VECTOR],
    { length: 64 },
    1,
  ]) {
    assert.equal(isValidSignature("Polyjuice", signature, "Polina"), false);
  }
  for (const data of [undefined, null, 1, ["Polyjuice"], { a: 1 }]) {
    assert.equal(isValidSignature(data, VECTOR, "Polina"), false);
  }
});

test("isValidSignature never accepts an empty key", () => {
  const signature = createHmac("sha256", "").update("data").digest("hex");
  assert.equal(isValidSignature("data", signature, ""), false);
});
