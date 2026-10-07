import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import {
  decryptApiKey,
  encryptApiKey,
  revealShopApiKey,
  sealApiKey,
  sealShopApiKeyWrite,
} from "./api-key-crypto.server";

const TEST_KEY = randomBytes(32).toString("base64");

const withEncryptionKey = (fn: () => void) => {
  const previous = process.env.API_KEY_ENCRYPTION_KEY;
  process.env.API_KEY_ENCRYPTION_KEY = TEST_KEY;
  try {
    fn();
  } finally {
    if (previous === undefined) {
      delete process.env.API_KEY_ENCRYPTION_KEY;
    } else {
      process.env.API_KEY_ENCRYPTION_KEY = previous;
    }
  }
};

test("round-trips a Yespo api key", () => {
  withEncryptionKey(() => {
    const plaintext = "yespo_live_example_key_7f3a9c";
    const encrypted = encryptApiKey(plaintext);

    assert.equal(
      decryptApiKey(encrypted.ciphertext, encrypted.iv, encrypted.authTag),
      plaintext,
    );
    assert.equal(Buffer.from(encrypted.iv, "base64").length, 12);
    assert.equal(Buffer.from(encrypted.authTag, "base64").length, 16);
    assert.notEqual(encrypted.ciphertext, plaintext);
  });
});

test("uses a new IV for every encryption", () => {
  withEncryptionKey(() => {
    const first = encryptApiKey("same-key");
    const second = encryptApiKey("same-key");

    assert.notEqual(first.iv, second.iv);
    assert.notEqual(first.ciphertext, second.ciphertext);
  });
});

test("rejects a tampered auth tag", () => {
  withEncryptionKey(() => {
    const encrypted = encryptApiKey("yespo-key");
    const tag = Buffer.from(encrypted.authTag, "base64");
    tag[0] ^= 0xff;

    assert.throws(
      () =>
        decryptApiKey(
          encrypted.ciphertext,
          encrypted.iv,
          tag.toString("base64"),
        ),
      /Failed to decrypt apiKey/,
    );
  });
});

test("stores an empty api key without IV or auth tag", () => {
  const previous = process.env.API_KEY_ENCRYPTION_KEY;
  delete process.env.API_KEY_ENCRYPTION_KEY;
  try {
    assert.deepEqual(sealApiKey(""), {
      apiKey: "",
      apiKeyIv: null,
      apiKeyAuthTag: null,
    });
    assert.deepEqual(sealApiKey(null), {
      apiKey: null,
      apiKeyIv: null,
      apiKeyAuthTag: null,
    });
  } finally {
    if (previous === undefined) {
      delete process.env.API_KEY_ENCRYPTION_KEY;
    } else {
      process.env.API_KEY_ENCRYPTION_KEY = previous;
    }
  }
});

test("returns a legacy plaintext row unchanged", () => {
  const previous = process.env.API_KEY_ENCRYPTION_KEY;
  delete process.env.API_KEY_ENCRYPTION_KEY;
  try {
    const shop = revealShopApiKey({
      shopUrl: "yespo-dev-store-2.myshopify.com",
      apiKey: "plain-key",
      apiKeyIv: null,
      apiKeyAuthTag: null,
    });

    assert.equal(shop.apiKey, "plain-key");
  } finally {
    if (previous === undefined) {
      delete process.env.API_KEY_ENCRYPTION_KEY;
    } else {
      process.env.API_KEY_ENCRYPTION_KEY = previous;
    }
  }
});

test("seals a new api key and reveals it back", () => {
  withEncryptionKey(() => {
    const sealed = sealApiKey("merchant-key");
    const shop = revealShopApiKey({
      shopUrl: "yespo-dev-store-2.myshopify.com",
      ...sealed,
    });

    assert.equal(shop.apiKey, "merchant-key");
    assert.ok(sealed.apiKeyIv);
    assert.ok(sealed.apiKeyAuthTag);
  });
});

test("leaves a shop update untouched when apiKey is absent", () => {
  const previous = process.env.API_KEY_ENCRYPTION_KEY;
  delete process.env.API_KEY_ENCRYPTION_KEY;
  try {
    const data = { name: "Demo", active: true };
    assert.deepEqual(sealShopApiKeyWrite(data), data);
  } finally {
    if (previous === undefined) {
      delete process.env.API_KEY_ENCRYPTION_KEY;
    } else {
      process.env.API_KEY_ENCRYPTION_KEY = previous;
    }
  }
});

test("rejects an incomplete ciphertext", () => {
  assert.throws(
    () =>
      revealShopApiKey({
        shopUrl: "yespo-dev-store-2.myshopify.com",
        apiKey: "ciphertext",
        apiKeyIv: "BnBu7oeANI6m1f7H",
        apiKeyAuthTag: null,
      }),
    /incomplete encrypted apiKey/,
  );
});
