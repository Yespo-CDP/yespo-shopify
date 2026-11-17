import {
  createGraphQLClient,
  type CustomFetchApi,
  type GraphQLClient,
} from "@shopify/graphql-client";

import { apiVersion } from "~/shopify.server";
import type { OfflineTokenManager } from "./offline-token-manager";

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

  if (!tokenManager) return client;

  // The client wraps errors thrown from `customFetchApi` into `errors`;
  // rethrow the stop error so the job ends instead of going on.
  const request: GraphQLClient["request"] = async (...args) => {
    tokenManager.throwIfStopped();
    const response = await client.request(...args);
    tokenManager.throwIfStopped();
    return response;
  };

  return { ...client, request };
};

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
