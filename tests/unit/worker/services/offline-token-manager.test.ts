import assert from "node:assert/strict";
import { mock, test } from "node:test";

const SHOP = "demo.myshopify.com";

const storedSession = { id: `offline_${SHOP}`, accessToken: "", refreshToken: "" };
const loadSession = mock.fn(async () => storedSession);
const storeSession = mock.fn(async (_session: typeof storedSession) => true);

mock.module("../../../../app/shopify.server", {
  namedExports: { sessionStorage: { loadSession, storeSession } },
});
mock.module("../../../../app/services/get-offline-session.server", {
  namedExports: { getOfflineAccessToken: async () => null },
});

const { createOfflineTokenManager } = await import(
  "../../../../app/worker/services/offline-token-manager"
);

function mockRefreshEndpoint() {
  return mock.method(globalThis, "fetch", async () =>
    Response.json({
      access_token: "new",
      expires_in: 3600,
      refresh_token: "refresh-new",
      refresh_token_expires_in: 7776000,
    }),
  );
}

function resetSession() {
  storedSession.accessToken = "old";
  storedSession.refreshToken = "refresh-old";
  storeSession.mock.resetCalls();
}

test("refreshes with the refresh token grant and stores the session", async () => {
  resetSession();
  process.env.SHOPIFY_API_KEY = "fake-key";
  process.env.SHOPIFY_API_SECRET = "fake-secret";
  const fetchMock = mockRefreshEndpoint();

  const token = await createOfflineTokenManager(SHOP).refreshAccessToken("old");

  assert.equal(token, "new");
  const [url, init] = fetchMock.mock.calls[0].arguments as [string, RequestInit];
  assert.equal(url, `https://${SHOP}/admin/oauth/access_token`);
  assert.equal(init.method, "POST");
  assert.equal(
    (init.headers as Record<string, string>)["Content-Type"],
    "application/json",
  );
  assert.deepEqual(JSON.parse(init.body as string), {
    client_id: "fake-key",
    client_secret: "fake-secret",
    refresh_token: "refresh-old",
    grant_type: "refresh_token",
  });
  assert.equal(storeSession.mock.callCount(), 1);
  const stored = storeSession.mock.calls[0].arguments[0];
  assert.equal(stored.id, `offline_${SHOP}`);
  assert.equal(stored.accessToken, "new");
  assert.equal(stored.refreshToken, "refresh-new");
  fetchMock.mock.restore();
});

test("parallel refreshes of one shop send a single refresh request", async () => {
  resetSession();
  const fetchMock = mockRefreshEndpoint();

  const tokens = await Promise.all([
    createOfflineTokenManager(SHOP).refreshAccessToken("old"),
    createOfflineTokenManager(SHOP).refreshAccessToken("old"),
    createOfflineTokenManager(SHOP).refreshAccessToken("old"),
  ]);

  assert.deepEqual(tokens, ["new", "new", "new"]);
  assert.equal(fetchMock.mock.callCount(), 1);
  fetchMock.mock.restore();
});

test("uses the stored token when another job already replaced it", async () => {
  resetSession();
  storedSession.accessToken = "replaced";
  const fetchMock = mockRefreshEndpoint();

  const token = await createOfflineTokenManager(SHOP).refreshAccessToken("old");

  assert.equal(token, "replaced");
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.equal(storeSession.mock.callCount(), 0);
  fetchMock.mock.restore();
});
