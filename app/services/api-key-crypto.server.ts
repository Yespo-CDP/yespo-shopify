import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

export type SealedApiKey = {
  apiKey: string | null;
  apiKeyIv: string | null;
  apiKeyAuthTag: string | null;
};

type ShopApiKeyFields = {
  shopUrl?: string;
  apiKey: string | null;
  apiKeyIv: string | null;
  apiKeyAuthTag: string | null;
};

/**
 * Loads the single AES-256 key from `API_KEY_ENCRYPTION_KEY` (base64, 32 bytes).
 */
const loadEncryptionKey = (): Buffer => {
  const raw = process.env.API_KEY_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("API_KEY_ENCRYPTION_KEY is not set");
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error("API_KEY_ENCRYPTION_KEY must decode to 32 bytes");
  }

  return key;
};

/**
 * Encrypts a Yespo API key. Each call uses a new 12-byte IV.
 * The plaintext is not logged.
 */
export const encryptApiKey = (
  plaintext: string,
): { ciphertext: string; iv: string; authTag: string } => {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, loadEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
};

/**
 * Decrypts a Yespo API key. Fails when the auth tag does not match.
 */
export const decryptApiKey = (
  ciphertext: string,
  iv: string,
  authTag: string,
): string => {
  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      loadEncryptionKey(),
      Buffer.from(iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(authTag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "API_KEY_ENCRYPTION_KEY is not set" ||
        error.message === "API_KEY_ENCRYPTION_KEY must decode to 32 bytes")
    ) {
      throw error;
    }
    throw new Error("Failed to decrypt apiKey");
  }
};

/**
 * Prepares `apiKey` for a database write.
 * An empty string and `null` stay without IV and auth tag.
 */
export const sealApiKey = (apiKey: string | null): SealedApiKey => {
  if (apiKey === null) {
    return { apiKey: null, apiKeyIv: null, apiKeyAuthTag: null };
  }

  if (apiKey === "") {
    return { apiKey: "", apiKeyIv: null, apiKeyAuthTag: null };
  }

  const encrypted = encryptApiKey(apiKey);
  return {
    apiKey: encrypted.ciphertext,
    apiKeyIv: encrypted.iv,
    apiKeyAuthTag: encrypted.authTag,
  };
};

/**
 * Applies {@link sealApiKey} when a write payload includes `apiKey`.
 * Other fields are left unchanged, so an update that does not touch the key
 * does not require the encryption key.
 */
export const sealShopApiKeyWrite = <T extends object>(data: T): T => {
  if (!Object.prototype.hasOwnProperty.call(data, "apiKey")) {
    return data;
  }

  const raw = (data as { apiKey?: unknown }).apiKey;
  if (typeof raw === "undefined") {
    return data;
  }
  if (raw !== null && typeof raw !== "string") {
    throw new Error("Shop.apiKey must be a string or null");
  }

  return {
    ...data,
    ...sealApiKey(raw),
  };
};

/**
 * Returns the shop with a usable Yespo API key.
 * Rows whose IV and auth tag are both null still hold plaintext.
 */
export const revealShopApiKey = <T extends ShopApiKeyFields>(shop: T): T => {
  const { apiKey, apiKeyIv, apiKeyAuthTag } = shop;
  if (apiKeyIv == null && apiKeyAuthTag == null) {
    return shop;
  }

  if (!apiKey || apiKeyIv == null || apiKeyAuthTag == null) {
    const shopUrl = shop.shopUrl ?? "unknown";
    throw new Error(`Shop ${shopUrl} has an incomplete encrypted apiKey`);
  }

  return {
    ...shop,
    apiKey: decryptApiKey(apiKey, apiKeyIv, apiKeyAuthTag),
  };
};
