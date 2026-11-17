import assert from "node:assert/strict";
import { mock, test } from "node:test";

const SHOP = "demo.myshopify.com";
const GRAPHQL_URL = `https://${SHOP}/admin/api/2026-04/graphql.json`;
const OAUTH_URL = `https://${SHOP}/admin/oauth/access_token`;

const getOfflineAccessToken = mock.fn(async (): Promise<string | null> => null);
const storedSession = {
  accessToken: "",
  refreshToken: "",
  expires: undefined as Date | undefined,
};
const storeSession = mock.fn(async () => true);

mock.module("../../../../app/shopify.server", {
  namedExports: {
    apiVersion: "2026-04",
    sessionStorage: {
      loadSession: async () => storedSession,
      storeSession,
    },
  },
});
mock.module("../../../../app/services/get-offline-session.server", {
  namedExports: { getOfflineAccessToken },
});

const { createClient } = await import(
  "../../../../app/worker/services/create-client"
);
const { createOfflineTokenManager } = await import(
  "../../../../app/worker/services/offline-token-manager"
);

const QUERY = "query { shop { name } }";

/**
 * Fake Shopify: GraphQL requests succeed only with a token from `validTokens`;
 * a refresh issues the next token from `refreshedTokens`.
 */
function mockShopify({
  validTokens,
  refreshedTokens = [],
}: {
  validTokens: Set<string>;
  refreshedTokens?: string[];
}) {
  const graphqlTokens: string[] = [];
  const fetchMock = mock.method(
    globalThis,
    "fetch",
    async (url: string, init?: RequestInit) => {
      if (url === OAUTH_URL) {
        const accessToken = refreshedTokens.shift();
        if (!accessToken) return new Response("{}", { status: 401 });
        return Response.json({
          access_token: accessToken,
          expires_in: 3600,
          refresh_token: `refresh-${accessToken}`,
          refresh_token_expires_in: 7776000,
        });
      }

      assert.equal(url, GRAPHQL_URL);
      const token = (init?.headers as Record<string, string>)[
        "X-Shopify-Access-Token"
      ];
      graphqlTokens.push(token);
      if (!validTokens.has(token)) {
        return new Response("Unauthorized", { status: 401 });
      }
      return Response.json({ data: { shop: { name: "Demo" } } });
    },
  );
  return { fetchMock, graphqlTokens };
}

function resetSession(accessToken: string) {
  storedSession.accessToken = accessToken;
  storedSession.refreshToken = "refresh";
  storedSession.expires = undefined;
  storeSession.mock.resetCalls();
}

test("uses the app Admin API version in the client URL", () => {
  const client = createClient({
    shop: SHOP,
    accessToken: "token",
  });

  assert.equal(client.config.url, GRAPHQL_URL);
});

test("without a token manager every request uses the static token", async () => {
  const { fetchMock, graphqlTokens } = mockShopify({
    validTokens: new Set(["static"]),
  });
  const client = createClient({ shop: SHOP, accessToken: "static" });

  await client.request(QUERY);
  await client.request(QUERY);

  assert.deepEqual(graphqlTokens, ["static", "static"]);
  fetchMock.mock.restore();
});

test("takes a fresh token for every request", async () => {
  const { fetchMock, graphqlTokens } = mockShopify({
    validTokens: new Set(["t1", "t2"]),
  });
  const tokens = ["t1", "t2"];
  getOfflineAccessToken.mock.mockImplementation(async () => tokens.shift()!);
  const client = createClient({
    shop: SHOP,
    accessToken: "t0",
    tokenManager: createOfflineTokenManager(SHOP),
  });

  const first = await client.request(QUERY);
  const second = await client.request(QUERY);

  assert.deepEqual(graphqlTokens, ["t1", "t2"]);
  assert.equal(first.errors, undefined);
  assert.equal(second.errors, undefined);
  fetchMock.mock.restore();
});

test("sends the last known token when a fresh one can't be read", async () => {
  const { fetchMock, graphqlTokens } = mockShopify({
    validTokens: new Set(["t1"]),
  });
  const tokens: Array<string | null> = ["t1", null];
  getOfflineAccessToken.mock.mockImplementation(async () => tokens.shift()!);
  const client = createClient({
    shop: SHOP,
    accessToken: "t1",
    tokenManager: createOfflineTokenManager(SHOP),
  });

  await client.request(QUERY);
  const second = await client.request(QUERY);

  assert.equal(second.errors, undefined);
  assert.deepEqual(graphqlTokens, ["t1", "t1"]);
  fetchMock.mock.restore();
});

test("on 401 refreshes the token, stores it and retries the request", async () => {
  resetSession("old");
  const { fetchMock, graphqlTokens } = mockShopify({
    validTokens: new Set(["new"]),
    refreshedTokens: ["new"],
  });
  getOfflineAccessToken.mock.mockImplementation(
    async () => storedSession.accessToken,
  );
  const client = createClient({
    shop: SHOP,
    accessToken: "old",
    tokenManager: createOfflineTokenManager(SHOP),
  });

  const first = await client.request(QUERY);
  const second = await client.request(QUERY);

  assert.equal(first.errors, undefined);
  assert.deepEqual(first.data, { shop: { name: "Demo" } });
  assert.equal(second.errors, undefined);
  assert.deepEqual(graphqlTokens, ["old", "new", "new"]);
  assert.equal(storeSession.mock.callCount(), 1);
  assert.equal(storedSession.accessToken, "new");
  assert.equal(storedSession.refreshToken, "refresh-new");
  assert.ok(storedSession.expires instanceof Date);
  fetchMock.mock.restore();
});

test("stops the job after more than 10 failed requests; a recovered request resets the counter", async () => {
  resetSession("bad");
  const refreshedTokens: string[] = [];
  const { fetchMock, graphqlTokens } = mockShopify({
    validTokens: new Set(["good"]),
    refreshedTokens,
  });
  getOfflineAccessToken.mock.mockImplementation(async () => "bad");
  const client = createClient({
    shop: SHOP,
    accessToken: "bad",
    tokenManager: createOfflineTokenManager(SHOP),
  });
  const failRequests = async (count: number) => {
    for (let i = 0; i < count; i++) {
      const response = await client.request(QUERY);
      assert.equal(response.errors?.networkStatusCode, 401);
    }
  };

  await failRequests(10);

  // A refresh that lets the retried request succeed resets the counter.
  refreshedTokens.push("good");
  const recovered = await client.request(QUERY);
  assert.equal(recovered.errors, undefined);
  storedSession.accessToken = "bad";

  await failRequests(10);
  await assert.rejects(client.request(QUERY), /more than 10 requests/);

  const sentBeforeStop = graphqlTokens.length;
  await assert.rejects(client.request(QUERY), /job stopped/);
  assert.equal(graphqlTokens.length, sentBeforeStop);
  fetchMock.mock.restore();
});
