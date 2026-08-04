import { sessionStorage } from "~/shopify.server";

export type MigrationResult = "migrated" | "skipped" | "no-session";

const OFFLINE_ACCESS_TOKEN_TYPE =
  "urn:shopify:params:oauth:token-type:offline-access-token";
const TOKEN_EXCHANGE_GRANT_TYPE =
  "urn:ietf:params:oauth:grant-type:token-exchange";

interface ExpiringTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
  scope?: string;
}

/**
 * One-time migration of a shop's non-expiring offline token to an expiring one.
 *
 * The SDK's `tokenExchange` only supports an id_token subject, so the migration
 * exchange (subject = the existing offline access token) is done with a raw POST
 * to the shop's OAuth endpoint, as described in Shopify's "Migrating from
 * non-expiring to expiring tokens" guide.
 *
 * Idempotent: shops that already have a refresh token, have no offline session,
 * or whose token is already invalid are skipped. Transient failures (429/5xx)
 * are thrown so the BullMQ job retries with backoff.
 *
 * Caution: on success Shopify revokes the old non-expiring token immediately, so
 * the refreshed session is persisted right after the exchange. This migration is
 * irreversible.
 *
 * @param {string} shopUrl - The shop's myshopify domain.
 * @returns {Promise<MigrationResult>} The outcome for this shop.
 */
export async function migrateOfflineTokenToExpiring(
  shopUrl: string,
): Promise<MigrationResult> {
  const session = await sessionStorage.loadSession(`offline_${shopUrl}`);

  if (!session?.accessToken) return "no-session";
  if (session.refreshToken) return "skipped";

  const response = await fetch(`https://${shopUrl}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      grant_type: TOKEN_EXCHANGE_GRANT_TYPE,
      subject_token: session.accessToken,
      subject_token_type: OFFLINE_ACCESS_TOKEN_TYPE,
      requested_token_type: OFFLINE_ACCESS_TOKEN_TYPE,
      expiring: "1",
    }),
  });

  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({}) as Record<string, unknown>);

    // The old token is already invalid (e.g. app uninstalled) — nothing to migrate.
    if (response.status === 400 && body?.error === "invalid_subject_token") {
      return "skipped";
    }

    // Transient (rate limit / server) — let the job retry with backoff.
    throw new Error(
      `Token migration failed for ${shopUrl}: ${response.status} ${JSON.stringify(body)}`,
    );
  }

  const data = (await response.json()) as ExpiringTokenResponse;
  const now = Date.now();

  session.accessToken = data.access_token;
  session.scope = data.scope ?? session.scope;
  session.expires = new Date(now + data.expires_in * 1000);
  session.refreshToken = data.refresh_token;
  session.refreshTokenExpires = new Date(
    now + data.refresh_token_expires_in * 1000,
  );

  await sessionStorage.storeSession(session);

  return "migrated";
}
