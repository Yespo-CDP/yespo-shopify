import { getOfflineAccessToken } from "~/services/get-offline-session.server";
import { sessionStorage } from "~/shopify.server";

/** A job stops once more than this many requests fail with a rejected token. */
export const MAX_FAILED_TOKEN_REQUESTS = 10;

interface RefreshTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
}

/**
 * Keeps the Shopify offline access token of one shop fresh during a
 * background job and counts requests Shopify rejected with 401.
 */
export interface OfflineTokenManager {
  /**
   * Current token; refreshed by the SDK when it is close to expiring. If a
   * fresh one can't be read, returns the last token this manager obtained.
   */
  getAccessToken(): Promise<string | null>;
  /** New token after Shopify rejected `failedToken`, or null if refresh failed. */
  refreshAccessToken(failedToken: string): Promise<string | null>;
  /** A request still failed with a rejected token. */
  recordFailedRequest(): void;
  /** A request succeeded after a refresh: resets the failure counter. */
  recordRecoveredRequest(): void;
  /** Throws once more than MAX_FAILED_TOKEN_REQUESTS requests failed. */
  throwIfStopped(): void;
}

// Token reads and refreshes of a shop run one at a time in this process, so
// parallel jobs never refresh the same shop at once ("Refresh one store at a
// time" — Shopify token exchange docs).
const shopQueues = new Map<string, Promise<unknown>>();

function runExclusive<T>(shop: string, task: () => Promise<T>): Promise<T> {
  const result = (shopQueues.get(shop) ?? Promise.resolve()).then(task);
  const tail = result.catch(() => undefined);
  shopQueues.set(shop, tail);
  void tail.then(() => {
    if (shopQueues.get(shop) === tail) shopQueues.delete(shop);
  });
  return result;
}

/**
 * Refreshes the offline session with its refresh token (same request as the
 * SDK's `auth.refreshToken`, which `shopifyApp` does not expose) and stores it.
 * If another job already replaced the rejected token, returns the stored one.
 */
async function refreshOfflineSession(
  shop: string,
  failedToken: string,
): Promise<string | null> {
  try {
    const session = await sessionStorage.loadSession(`offline_${shop}`);
    if (!session?.accessToken) return null;
    if (session.accessToken !== failedToken) return session.accessToken;
    if (!session.refreshToken) return null;

    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        refresh_token: session.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      console.error(
        `Offline token refresh failed for ${shop}: HTTP ${response.status}`,
      );
      return null;
    }

    const data = (await response.json()) as RefreshTokenResponse;
    if (!data.access_token) {
      console.error(`Offline token refresh failed for ${shop}: no token`);
      return null;
    }

    const now = Date.now();
    session.accessToken = data.access_token;
    session.scope = data.scope ?? session.scope;
    if (data.expires_in) {
      session.expires = new Date(now + data.expires_in * 1000);
    }
    if (data.refresh_token && data.refresh_token_expires_in) {
      session.refreshToken = data.refresh_token;
      session.refreshTokenExpires = new Date(
        now + data.refresh_token_expires_in * 1000,
      );
    }

    await sessionStorage.storeSession(session);

    return session.accessToken;
  } catch (error) {
    // Only the error name: storage errors may echo session fields.
    console.error(
      `Offline token refresh failed for ${shop}:`,
      error instanceof Error ? error.name : "unknown error",
    );
    return null;
  }
}

/**
 * Creates the token manager for one background job of `shop`.
 *
 * @param {string} shop - The shop's myshopify domain.
 * @returns {OfflineTokenManager} Manager to pass to `createClient`.
 */
export function createOfflineTokenManager(shop: string): OfflineTokenManager {
  let failedRequests = 0;
  // Last token obtained or refreshed; still used when a later read fails
  // (e.g. SDK refresh or DB hiccup), so a request is not dropped unsent.
  let lastKnownToken: string | null = null;
  const remember = (token: string | null) => {
    if (token) lastKnownToken = token;
    return lastKnownToken;
  };

  return {
    getAccessToken: async () =>
      remember(await runExclusive(shop, () => getOfflineAccessToken(shop))),
    refreshAccessToken: async (failedToken) => {
      const token = await runExclusive(shop, () =>
        refreshOfflineSession(shop, failedToken),
      );
      if (token) lastKnownToken = token;
      return token;
    },
    recordFailedRequest: () => {
      failedRequests += 1;
    },
    recordRecoveredRequest: () => {
      failedRequests = 0;
    },
    throwIfStopped: () => {
      if (failedRequests > MAX_FAILED_TOKEN_REQUESTS) {
        throw new Error(
          `Shopify rejected the access token for ${shop} in more than ${MAX_FAILED_TOKEN_REQUESTS} requests; job stopped`,
        );
      }
    },
  };
}
