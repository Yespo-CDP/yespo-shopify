export const READ_MARKETS_SCOPE = "read_markets";

/**
 * Returns true when the session includes `read_markets`.
 * Accepts the comma-separated `Session.scope` string or the webhook array.
 */
export function hasReadMarketsScope(
  scopes: string | string[] | null | undefined,
): boolean {
  if (!scopes) {
    return false;
  }

  const granted = (Array.isArray(scopes) ? scopes : scopes.split(","))
    .map((scope) => scope.trim())
    .filter(Boolean);

  return granted.includes(READ_MARKETS_SCOPE);
}
