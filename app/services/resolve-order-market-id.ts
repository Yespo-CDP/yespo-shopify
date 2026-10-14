import { readMarketId } from "./market-tracking";

/**
 * Market id for a Yespo order.
 * The visit market wins. When that record is gone, the order address is used:
 * shipping country, then billing, then the customer's default country.
 */
export function orderMarketIdCandidate(input: {
  storedMarketId?: string | null;
  shippingCountryCode?: string | null;
  billingCountryCode?: string | null;
  customerCountryCode?: string | null;
}): string | null {
  return (
    readMarketId(input.storedMarketId) ??
    readMarketId(input.shippingCountryCode) ??
    readMarketId(input.billingCountryCode) ??
    readMarketId(input.customerCountryCode)
  );
}

/**
 * Cart token on a Shopify order webhook.
 * `cart_token` wins; note attributes cover checkouts that only stored it there.
 * The `?key=` suffix is not part of the token EventData is saved under.
 */
export function readOrderCartToken(payload: {
  cart_token?: string | null;
  note_attributes?: Array<{
    name?: string | null;
    value?: string | null;
  }> | null;
}): string | null {
  const attribute = payload.note_attributes?.find((attr) => {
    const name = attr.name?.trim().toLowerCase();
    return name === "cart token" || name === "cartid";
  })?.value;

  const raw = payload.cart_token || attribute;
  if (!raw) return null;

  const token = raw.split("?key=")[0]?.trim();
  return token || null;
}
