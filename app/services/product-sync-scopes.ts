export const PRODUCT_SYNC_SCOPES = [
  "read_products",
  "read_publications",
  "read_translations",
  "read_locales",
  "unauthenticated_read_product_listings",
] as const;

/**
 * Returns true when every scope required for product sync is granted.
 * Accepts the comma-separated `Session.scope` string or the webhook array.
 * Shopify omits `read_products` when `write_products` is granted, and that
 * write scope already includes read access.
 */
export function hasProductSyncScopes(
  scopes: string | string[] | null | undefined,
): boolean {
  if (!scopes) {
    return false;
  }

  const granted = (Array.isArray(scopes) ? scopes : scopes.split(","))
    .map((scope) => scope.trim())
    .filter(Boolean);

  return PRODUCT_SYNC_SCOPES.every(
    (required) =>
      granted.includes(required) ||
      (required === "read_products" && granted.includes("write_products")),
  );
}
