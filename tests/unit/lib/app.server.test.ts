import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const API_KEY = "0123456789ABCDEF";
const noop = async () => ({});

const state = { apiKey: API_KEY as string | null };
const connectAccountService = mock.fn<
  (args: { apiKey: string }) => Promise<void>
>(async () => {});

const named = (path: string, names: string[]) =>
  mock.module(`../../../app/${path}`, {
    namedExports: Object.fromEntries(names.map((name) => [name, noop])),
  });

mock.module("../../../app/shopify.server", {
  namedExports: {
    authenticate: {
      admin: async () => ({
        admin: {},
        session: { shop: "demo.myshopify.com", accessToken: "token" },
      }),
    },
  },
});
mock.module("../../../app/i18n.server", {
  defaultExport: {
    // Like i18next: the first known key wins, an unknown single key is returned.
    getFixedT: async () => (keys: string | string[]) => {
      const list = [keys].flat();
      const known = /errors\.(invalidApiKey|emptyApiKey|unknownError)$/;
      return list.find((key) => known.test(key)) ?? list[list.length - 1];
    },
  },
});
mock.module("../../../app/repositories/repositories.server", {
  namedExports: {
    shopRepository: {
      getShop: async () => ({ apiKey: state.apiKey, shopUrl: "demo" }),
      updateShop: noop,
    },
    customerSyncLogRepository: { getCustomerSyncLogByShop: noop },
    orderSyncLogRepository: { getOrderSyncLogByShop: noop },
    productVariantSyncLogRepository: {},
    marketSyncLogRepository: { getByShop: noop },
  },
});
mock.module("../../../app/services/connect-account.server", {
  namedExports: { connectAccountService },
});
for (const path of [
  "services/check-script-connection.server",
  "services/check-theme-extension.server",
  "services/afterAuth.server",
  "services/switch-app-inbox-script-mode.server",
]) {
  mock.module(`../../../app/${path}`, { defaultExport: noop });
}
named("api/get-account-info.server", ["getAccountInfo"]);
named("api/create-general-domain.server", ["createGeneralDomain"]);
named("api/send-log-event", ["sendLogEvent"]);
named("services/disconnect-account.server", ["disconnectAccountService"]);
named("services/connect-general-script.server", ["connectGeneralScriptService"]);
named("services/connect-webpush-script.server", ["connectWebPushScriptService"]);
named("services/toggle-web-tracking.server", ["toggleWebTrackingServer"]);
named("services/get-product-variant-sync-log.server", ["getProductVariantSyncLogView"]);
named("services/queue", ["enqueueDataSyncTasks", "enqueueMarketSyncTaskForShopUrl"]);
named("services/send-access-token.server", ["sendAccessTokenService"]);
named("services/delete-access-token.server", ["deleteAccessTokenService"]);
named("services/enable-product-sync-for-rollout.server", ["enableProductSyncForRollout"]);
named("services/ensure-web-push-multi-domain.server", ["ensureWebPushMultiDomain"]);
named("services/sync-market-tracking-metafield.server", ["countEnabledMarkets"]);

const { actionHandler, loaderHandler } = await import(
  "../../../app/lib/app.server"
);

const connect = (apiKey: string) =>
  actionHandler({
    request: new Request("https://app.example/app", {
      method: "POST",
      body: new URLSearchParams({ intent: "account-connection", apiKey }),
    }),
  } as Parameters<typeof actionHandler>[0]);

const connectedKeys = () =>
  connectAccountService.mock.calls.map((call) => call.arguments[0].apiKey);

beforeEach(() => {
  state.apiKey = API_KEY;
  connectAccountService.mock.resetCalls();
  connectAccountService.mock.mockImplementation(async () => {});
});

test("loader masks every character of the API key", async () => {
  const data = await loaderHandler({
    request: new Request("https://app.example/app"),
  } as Parameters<typeof loaderHandler>[0]);

  assert.equal(data.shop?.apiKey, "*".repeat(API_KEY.length));
  assert.ok(!JSON.stringify(data).includes(API_KEY.slice(-4)));
});

test("loader returns an empty key when none is stored", async () => {
  state.apiKey = null;

  const data = await loaderHandler({
    request: new Request("https://app.example/app"),
  } as Parameters<typeof loaderHandler>[0]);

  assert.equal(data.shop?.apiKey, "");
});

test("a submitted mask of any length does not reconnect", async () => {
  for (const mask of ["*".repeat(API_KEY.length), "***", ` ${"*".repeat(20)} `]) {
    assert.deepEqual(await connect(mask), { success: {}, errors: {} });
  }
  assert.equal(connectAccountService.mock.callCount(), 0);
});

test("an empty or blank key is rejected before Yespo is called", async () => {
  for (const apiKey of ["", "   "]) {
    const result = await connect(apiKey);
    assert.equal(
      result.errors.apiKey,
      "AccountConnectionSection.errors.emptyApiKey",
    );
  }
  assert.equal(connectAccountService.mock.callCount(), 0);
});

test("a new key is connected without the surrounding spaces", async () => {
  const result = await connect("  NEWKEY  ");

  assert.deepEqual(connectedKeys(), ["NEWKEY"]);
  assert.equal(result.success.apiKey, true);
});

test("asterisks without a stored key and an edited mask are checked by Yespo", async () => {
  connectAccountService.mock.mockImplementation(async () => {
    throw new Error("invalidApiKey");
  });

  const edited = await connect("****X");
  state.apiKey = null;
  const noStoredKey = await connect("****");

  assert.deepEqual(connectedKeys(), ["****X", "****"]);
  for (const result of [edited, noStoredKey]) {
    assert.equal(
      result.errors.apiKey,
      "AccountConnectionSection.errors.invalidApiKey",
    );
    assert.equal(result.success.apiKey, undefined);
  }
});

test("an unexpected failure shows the translated unknown error", async () => {
  connectAccountService.mock.mockImplementation(async () => {
    throw new Error("fetch failed");
  });

  const result = await connect("NEWKEY");

  assert.equal(
    result.errors.apiKey,
    "AccountConnectionSection.errors.unknownError",
  );
});
