import { PrismaClient } from "@prisma/client";

import { encryptApiKey } from "~/services/api-key-crypto.server";

/**
 * One-time encryption of Shop.apiKey values that are still plaintext
 * (`apiKeyIv` and `apiKeyAuthTag` are both null).
 *
 * Encrypts every shop that still has a plaintext key. Already encrypted
 * rows are excluded by the query, so a second run is a no-op.
 *
 * Requires DATABASE_URL and API_KEY_ENCRYPTION_KEY in the environment.
 * Usage: npm run encrypt:api-keys
 */

const prisma = new PrismaClient();

let encrypted = 0;
let skipped = 0;

try {
  const shops = await prisma.shop.findMany({
    where: {
      apiKeyIv: null,
      apiKeyAuthTag: null,
      AND: [{ apiKey: { not: null } }, { apiKey: { not: "" } }],
    },
    select: {
      id: true,
      shopUrl: true,
      apiKey: true,
    },
  });

  for (const shop of shops) {
    if (!shop.apiKey) {
      skipped += 1;
      console.log(`skip empty apiKey for ${shop.shopUrl}`);
      continue;
    }

    const sealed = encryptApiKey(shop.apiKey);
    const result = await prisma.shop.updateMany({
      where: {
        id: shop.id,
        apiKey: shop.apiKey,
        apiKeyIv: null,
        apiKeyAuthTag: null,
      },
      data: {
        apiKey: sealed.ciphertext,
        apiKeyIv: sealed.iv,
        apiKeyAuthTag: sealed.authTag,
      },
    });

    if (result.count === 1) {
      encrypted += 1;
      console.log(`encrypted ${shop.shopUrl}`);
    } else {
      skipped += 1;
      console.log(`skip ${shop.shopUrl}: row changed before update`);
    }
  }

  console.log(`done: encrypted ${encrypted}, skipped ${skipped}`);
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Failed to encrypt api keys";
  console.error(message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
