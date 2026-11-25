import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const SCRIPT = readFileSync(
  new URL("../../../extensions/yespo-extension/assets/web-tracking.js", import.meta.url),
  "utf8",
);

const CUSTOMER = { id: 123, email: "buyer@example.com" };
const PAGE = {
  host: "https://app.example",
  domain: "demo.myshopify.com",
  marketId: "ua",
  customer: CUSTOMER,
};

/** Runs the script on a page with this yespo_data, then creates a cart. Returns the sent bodies. */
const run = async (yespoData: object) => {
  const bodies: Record<string, unknown>[] = [];
  const context: Record<string, unknown> = {
    console,
    URLSearchParams,
    location: { pathname: "/", search: "" },
    history: {},
    addEventListener() {},
    document: {
      cookie: "sc=sc-1; cart=cart-1%3Fkey%3Dz",
      getElementById: () => ({ textContent: JSON.stringify(yespoData) }),
      querySelector: () => null,
    },
    fetch: async (url: string, options: { body: string }) => {
      if (url === "https://app.example/public/event-data") {
        bodies.push(JSON.parse(options.body));
        return new Response();
      }
      return Response.json({
        data: { result: { cart: { id: "gid://shopify/Cart/cart-2?key=z" } } },
      });
    },
  };
  context.window = context;
  vm.runInNewContext(SCRIPT, context);
  await new Promise((resolve) => setImmediate(resolve));

  // The page's own request, after the script has wrapped fetch.
  await (context.fetch as typeof fetch)(
    "/api/unstable/graphql.json?operation_name=cartCreate",
    { method: "POST" },
  );
  return bodies;
};

const expected = (signedData: string | null, signature: string | null) =>
  ["cart-1", "cart-2"].map((cartToken) => ({
    shop: "demo.myshopify.com",
    sc: "sc-1",
    cartToken,
    customer: CUSTOMER,
    marketId: "ua",
    signedData,
    signature,
  }));

test("sends signedData and signature unchanged for the page cart and for a created cart", async () => {
  const signedData = '{"shop":"demo.myshopify.com","firstName":"Олена \\u003c \\"Q\\""}';
  const signature = "a".repeat(64);

  assert.deepEqual(await run({ ...PAGE, signedData, signature }), expected(signedData, signature));
});

test("sends null for both when the page has no signature", async () => {
  assert.deepEqual(
    await run({ ...PAGE, signedData: null, signature: null }),
    expected(null, null),
  );
  // A page rendered by the previous version of yespo-script.liquid.
  assert.deepEqual(await run(PAGE), expected(null, null));
});
