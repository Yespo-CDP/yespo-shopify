export const PRODUCT_SYNC_SCOPES = [
  "read_products",
  "read_publications",
  "read_translations",
  "read_locales",
] as const;

/**
 * Returns true when every scope required for product sync is granted.
 * Accepts the comma-separated `Session.scope` string or the webhook array.
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

  return PRODUCT_SYNC_SCOPES.every((required) => granted.includes(required));
}
