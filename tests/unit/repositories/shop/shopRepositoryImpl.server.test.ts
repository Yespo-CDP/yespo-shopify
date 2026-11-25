import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mock, test } from "node:test";
import type { PrismaClient } from "@prisma/client";

import ShopRepositoryImpl from "../../../../app/repositories/shop/shopRepositoryImpl.server";
import { encryptApiKey } from "../../../../app/services/api-key-crypto.server";

const withEncryptionKey = async (key: string, fn: () => Promise<void>) => {
  const previous = process.env.API_KEY_ENCRYPTION_KEY;
  process.env.API_KEY_ENCRYPTION_KEY = key;
  try {
    await fn();
  } finally {
    if (previous === undefined) {
      delete process.env.API_KEY_ENCRYPTION_KEY;
    } else {
      process.env.API_KEY_ENCRYPTION_KEY = previous;
    }
  }
};

const createRepository = (rows: unknown[]) => {
  const shop = { findMany: mock.fn(async (_args?: unknown) => rows) };
  const repository = new ShopRepositoryImpl({ shop } as unknown as PrismaClient);
  return { repository, shop };
};

const logs = [{ status: "COMPLETE", updatedAt: new Date("2026-01-01T00:00:00Z") }];

test("market sync skips shops whose api key cannot be decrypted and logs no key data", async () => {
  const otherKey = randomBytes(32).toString("base64");
  let foreign = { ciphertext: "", iv: "", authTag: "" };
  await withEncryptionKey(otherKey, async () => {
    foreign = encryptApiKey("foreign-plain-key");
  });

  const plaintext = {
    shopUrl: "plain.myshopify.com",
    apiKey: "plain-key",
    apiKeyIv: null,
    apiKeyAuthTag: null,
    marketSyncLogs: logs,
  };
  const incomplete = {
    shopUrl: "broken.myshopify.com",
    apiKey: null,
    apiKeyIv: "x",
    apiKeyAuthTag: null,
    marketSyncLogs: [],
  };
  const wrongKey = {
    shopUrl: "foreign.myshopify.com",
    apiKey: foreign.ciphertext,
    apiKeyIv: foreign.iv,
    apiKeyAuthTag: foreign.authTag,
    marketSyncLogs: [],
  };
  const { repository } = createRepository([plaintext, incomplete, wrongKey]);
  const error = mock.method(console, "error", () => {});

  try {
    await withEncryptionKey(randomBytes(32).toString("base64"), async () => {
      const shops = await repository.getShopsForMarketSync();
      assert.deepEqual(shops, [plaintext]);
    });

    const messages = error.mock.calls.map((call) => call.arguments.join(" "));
    assert.equal(messages.length, 2);
    assert.match(messages[0], /broken\.myshopify\.com/);
    assert.match(messages[1], /foreign\.myshopify\.com/);
    for (const message of messages) {
      for (const secret of [foreign.ciphertext, foreign.iv, foreign.authTag, otherKey]) {
        assert.ok(!message.includes(secret));
      }
    }
  } finally {
    error.mock.restore();
  }
});

test("market sync returns encrypted shops with the decrypted api key", async () => {
  await withEncryptionKey(randomBytes(32).toString("base64"), async () => {
    const encrypted = encryptApiKey("yespo-key");
    const row = {
      shopUrl: "ok.myshopify.com",
      apiKey: encrypted.ciphertext,
      apiKeyIv: encrypted.iv,
      apiKeyAuthTag: encrypted.authTag,
      marketSyncLogs: logs,
    };
    const { repository, shop } = createRepository([row]);

    const shops = await repository.getShopsForMarketSync();

    assert.deepEqual(shops, [{ ...row, apiKey: "yespo-key" }]);
    assert.deepEqual(shop.findMany.mock.calls[0].arguments[0], {
      where: { active: true, isMarketSyncEnabled: true, apiKey: { not: null } },
      include: { marketSyncLogs: { select: { status: true, updatedAt: true } } },
    });
  });
});

test("getAllShops selects only shopUrl and does not decrypt", async () => {
  const rows = [{ shopUrl: "a.myshopify.com" }, { shopUrl: "b.myshopify.com" }];
  const { repository, shop } = createRepository(rows);

  const shops = await repository.getAllShops();

  assert.deepEqual(shop.findMany.mock.calls[0].arguments[0], {
    select: { shopUrl: true },
  });
  assert.deepEqual(shops, rows);
});

test("getShopUrlsWithoutPublicApiKey: active shops without a key, only shopUrl", async () => {
  const rows = [{ shopUrl: "a.myshopify.com" }];
  const { repository, shop } = createRepository(rows);

  const shops = await repository.getShopUrlsWithoutPublicApiKey();

  assert.deepEqual(shop.findMany.mock.calls[0].arguments[0], {
    where: { active: true, publicApiKey: null },
    select: { shopUrl: true },
  });
  assert.deepEqual(shops, rows);
});
