import {
  createGraphQLClient,
  type ClientResponse,
  type CustomFetchApi,
  type GraphQLClient,
} from "@shopify/graphql-client";

import { apiVersion } from "~/shopify.server";
import type { OfflineTokenManager } from "./offline-token-manager";

// Shopify recommends a 1 s backoff; also used when the response has no cost.
const THROTTLE_MIN_WAIT_MS = 1_000;
// Background jobs (with a token manager): one repeat is enough when the pause
// is right; the others cover other jobs of the same shop using the shared
// bucket meanwhile. 10 s restores the 1000-point single query max at
// 100 points/s (lowest plan).
const JOB_THROTTLE = { retries: 3, maxWaitMs: 10_000 };
// Web requests (no token manager) run inside webhook handlers that Shopify
// waits for at most 5 s: a single short repeat.
const WEB_THROTTLE = { retries: 1, maxWaitMs: 2_000 };

/**
 * Create Shopify GraphQL API.
 *
 * This function create new shopify client by `shop` and `accessToken`.
 *
 * @param {Object} params - The input parameters.
 * @param {string} params.shop - The unique URL identifier of the shop.
 * @param {string} params.accessToken - Access token from shopify session.
 * @param {OfflineTokenManager} [params.tokenManager] - For background jobs:
 * every request takes a fresh token from it, and a 401 is retried once after
 * a refresh. Without it the client uses `accessToken` for every request.
 * A request throttled by Shopify (`THROTTLED`) is repeated after a pause:
 * up to 3 times with pauses up to 10 s with a token manager, once with a
 * pause up to 2 s without it (webhook handlers must answer within 5 s).
 * @returns {GraphQLClient} New shopify graphql client GraphQLClient.
 *
 * @example
  const client = createClient({ shop, accessToken });
    const response = await client.request(
      `...`,
    );
 */
export const createClient = ({
  shop,
  accessToken,
  tokenManager,
}: {
  shop: string;
  accessToken: string;
  tokenManager?: OfflineTokenManager;
}): GraphQLClient => {
  const client = createGraphQLClient({
    url: `https://${shop}/admin/api/${apiVersion}/graphql.json`,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    retries: 1,
    ...(tokenManager && {
      customFetchApi: createTokenFetch(shop, tokenManager),
    }),
  });

  const throttle = tokenManager ? JOB_THROTTLE : WEB_THROTTLE;
  const request: GraphQLClient["request"] = async (...args) => {
    for (let attempt = 0; ; attempt++) {
      // The client wraps errors thrown from `customFetchApi` into `errors`;
      // rethrow the stop error so the job ends instead of going on.
      tokenManager?.throwIfStopped();
      const response = await client.request(...args);
      tokenManager?.throwIfStopped();

      const waitMs = throttleWaitMs(response, throttle.maxWaitMs);
      if (waitMs === null || attempt >= throttle.retries) return response;
      console.warn(`Shopify THROTTLED for ${shop}, retrying in ${waitMs} ms`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  };

  return { ...client, request };
};

/**
 * Pause before repeating a `THROTTLED` request: the time for the bucket to
 * restore the points the query lacks. `null` when the request was not
 * throttled. At most `maxWaitMs`. Shopify sends THROTTLED as HTTP 200 with
 * `errors[].extensions.code`, so the client itself does not retry it.
 */
function throttleWaitMs(
  { errors, extensions }: ClientResponse,
  maxWaitMs: number,
): number | null {
  const throttled = errors?.graphQLErrors?.some(
    (error) => error?.extensions?.code === "THROTTLED",
  );
  if (!throttled) return null;

  const cost = extensions?.cost;
  const missing =
    Number(cost?.requestedQueryCost) -
    Number(cost?.throttleStatus?.currentlyAvailable);
  const restoreRate = Number(cost?.throttleStatus?.restoreRate);
  const waitMs = (missing / restoreRate) * 1000;
  if (!Number.isFinite(waitMs)) return THROTTLE_MIN_WAIT_MS;
  return Math.min(
    Math.max(Math.ceil(waitMs), THROTTLE_MIN_WAIT_MS),
    maxWaitMs,
  );
}

function createTokenFetch(
  shop: string,
  tokenManager: OfflineTokenManager,
): CustomFetchApi {
  // The client calls `customFetchApi` again with the same `init` when it
  // retries (429/503/thrown error); count each request as failed only once.
  const failedRequests = new WeakSet<object>();
  const recordFailure = (init?: object) => {
    if (init && failedRequests.has(init)) return;
    if (init) failedRequests.add(init);
    tokenManager.recordFailedRequest();
  };

  const withToken = (
    init: Parameters<CustomFetchApi>[1],
    token: string,
  ): Parameters<CustomFetchApi>[1] => ({
    ...init,
    headers: {
      ...(init?.headers as Record<string, string>),
      "X-Shopify-Access-Token": token,
    },
  });

  return async (url, init) => {
    tokenManager.throwIfStopped();

    const token = await tokenManager.getAccessToken();
    if (!token) {
      recordFailure(init);
      throw new Error(`No valid offline session for ${shop}`);
    }

    const response = await fetch(url, withToken(init, token));
    if (response.status !== 401) return response;

    const refreshedToken = await tokenManager.refreshAccessToken(token);
    if (!refreshedToken) {
      recordFailure(init);
      return response;
    }

    // Release the discarded 401 body so its connection goes back to the pool.
    await response.body?.cancel().catch(() => undefined);
    const retried = await fetch(url, withToken(init, refreshedToken));
    if (retried.status === 401) {
      recordFailure(init);
    } else {
      tokenManager.recordRecoveredRequest();
    }
    return retried;
  };
}
