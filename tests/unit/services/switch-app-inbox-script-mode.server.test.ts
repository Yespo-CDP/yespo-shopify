import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const writes: { key: string; value: string }[] = [];
let scriptWriteResult: unknown = null;

mock.module("../../../app/shopify/queries/get-metafield", {
  defaultExport: async () => ({ value: "eS('init')" }),
});
mock.module("../../../app/shopify/mutations/create-metafield.server", {
  defaultExport: async (args: { key: string; value: string }) => {
    writes.push({ key: args.key, value: args.value });
    return writes.length === 1 ? scriptWriteResult : { key: args.key, value: args.value };
  },
});

const { default: switchAppInboxScriptServer } = await import(
  "../../../app/services/switch-app-inbox-script-mode.server"
);

const run = () =>
  switchAppInboxScriptServer({ enabled: true, admin: {}, shopId: "gid://shopify/Shop/1" });

beforeEach(() => {
  writes.length = 0;
  scriptWriteResult = null;
});

test("rejects when the script metafield is not written", async () => {
  await assert.rejects(run, /Failed to update Yespo script metafield/);
  assert.equal(writes.length, 1);
});

test("resolves when the script metafield is written", async () => {
  scriptWriteResult = { key: "yespo-script", value: "updated" };

  await run();

  assert.match(writes[0].value, /APP_INBOX: true/);
});
