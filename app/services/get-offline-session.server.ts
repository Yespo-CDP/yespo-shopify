import { unauthenticated } from "~/shopify.server";

/**
 * Returns a valid offline access token for the shop.
 *
 * Delegates to the SDK's `unauthenticated.admin`, which loads the offline
 * session and — with the `expiringOfflineAccessTokens` future flag enabled —
 * refreshes the access token via its refresh token when it is close to
 * expiring, persisting the refreshed session back to session storage.
 *
 * Call this at the moment the token is actually used (e.g. inside a worker job)
 * so background tasks always run with a fresh, non-expired token.
 *
 * @param {string} shopUrl - The shop's myshopify domain.
 * @returns {Promise<string | null>} A valid access token, or null when the shop
 * has no offline session.
 */
export async function getOfflineAccessToken(
  shopUrl: string,
): Promise<string | null> {
  try {
    const { session } = await unauthenticated.admin(shopUrl);
    return session?.accessToken ?? null;
  } catch (error) {
    console.error(`No valid offline session for ${shopUrl}:`, error);
    return null;
  }
}
