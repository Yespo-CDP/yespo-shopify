import { createHmac, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 32;

/**
 * Loads the key from `SHOP_ENCRYPTION_KEY` (base64, 32 bytes). It must never be
 * empty: shop ids are public, so anyone could then compute every shop key.
 */
const loadEncryptionKey = (): Buffer => {
  const raw = process.env.SHOP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("SHOP_ENCRYPTION_KEY is not set");
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error("SHOP_ENCRYPTION_KEY must decode to 32 bytes");
  }

  return key;
};

/**
 * Creates the shop's key for signing event data: HMAC-SHA256 hex of the numeric
 * shop id. The same shop always gets the same key.
 *
 * @param {string} shopGid - The shop GID (`gid://shopify/Shop/<id>`).
 */
export const createShopKey = (shopGid: string): string => {
  const shopId = /(\d+)$/.exec(shopGid)?.[1];
  if (!shopId) {
    throw new Error("Shop GID has no numeric shop id");
  }

  return createHmac("sha256", loadEncryptionKey()).update(shopId).digest("hex");
};

/**
 * Checks a signature made by the Liquid `hmac_sha256` filter. Liquid uses the
 * hex key as a plain string, so it is not decoded here.
 */
export const isValidSignature = (
  data: unknown,
  signature: unknown,
  key: string,
): boolean => {
  if (!key || typeof data !== "string" || typeof signature !== "string") {
    return false;
  }
  if (!/^[0-9a-f]{64}$/.test(signature)) return false;

  const expected = createHmac("sha256", key).update(data, "utf8").digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
};

const MAX_LENGTH = 255;
const MAX_SIGNED_DATA_BYTES = 4096;

// A string of reasonable length, else undefined (the field is not saved).
export const readString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length <= MAX_LENGTH ? value : undefined;

/**
 * Takes only the expected customer fields from the storefront body.
 * A field that is not a short string or null is dropped, so it is not updated.
 * Returns null when `id` is not a Shopify customer id (number or digits).
 */
export const readCustomer = (value: unknown) => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id =
    typeof raw.id === "number" && Number.isSafeInteger(raw.id)
      ? String(raw.id)
      : raw.id;
  if (typeof id !== "string" || !/^\d{1,20}$/.test(id)) return null;
  const field = (key: string) =>
    raw[key] === null ? null : readString(raw[key]);
  return {
    customerId: id,
    email: field("email"),
    phone: field("phone"),
    firstName: field("firstName"),
    lastName: field("lastName"),
  };
};

/**
 * Parses the JSON string that yespo-script.liquid signs. Its content is not
 * trusted until the signature is checked.
 * Returns null when it is too long or not a JSON object with a shop.
 */
export const readSignedData = (value: unknown) => {
  if (
    typeof value !== "string" ||
    Buffer.byteLength(value) > MAX_SIGNED_DATA_BYTES
  ) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    const shop = readString(parsed.shop);
    return shop
      ? { shop, marketId: parsed.marketId, customer: parsed.customer }
      : null;
  } catch {
    return null;
  }
};
