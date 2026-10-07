import { PrismaClient } from "@prisma/client";

import { encryptApiKey } from "~/services/api-key-crypto.server";

/**
 * One-time encryption of Shop.apiKey values that are still plaintext
 * (`apiKeyIv` and `apiKeyAuthTag` are both null).
 *
 * The first run encrypts a single shop. Other shops are skipped.
 * After that shop works against Yespo, clear ONLY_SHOP_URL to encrypt the rest.
 *
 * Requires DATABASE_URL and API_KEY_ENCRYPTION_KEY in the environment.
 * Usage: npm run encrypt:api-keys
 */
const ONLY_SHOP_URL: string | null = "yespo-staging-store2.myshopify.com";

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

  if (ONLY_SHOP_URL && !shops.some((shop) => shop.shopUrl === ONLY_SHOP_URL)) {
    console.log(`no plaintext apiKey for ${ONLY_SHOP_URL}`);
  }

  for (const shop of shops) {
    if (ONLY_SHOP_URL && shop.shopUrl !== ONLY_SHOP_URL) {
      skipped += 1;
      console.log(`skip ${shop.shopUrl}`);
      continue;
    }

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
