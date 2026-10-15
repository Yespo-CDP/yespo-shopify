import assert from "node:assert/strict";
import test from "node:test";

import {
  collectStorefrontHosts,
  diffStorefrontHosts,
} from "./collect-storefront-hosts";

test("keeps the primary domain and each distinct market host", () => {
  assert.deepEqual(
    collectStorefrontHosts("Shop.com", [
      "https://shop.com/",
      "https://shop.de/de",
      "https://shop.fr/fr-fr",
      "https://shop.de/en",
    ]),
    ["shop.com", "shop.de", "shop.fr"],
  );
});

test("ignores empty and malformed urls", () => {
  assert.deepEqual(collectStorefrontHosts("shop.com", ["", "not a url"]), [
    "shop.com",
  ]);
});

test("reports only hosts that were added or removed", () => {
  assert.deepEqual(
    diffStorefrontHosts(
      ["shop.com", "shop.de"],
      ["shop.com", "shop.fr"],
    ),
    { added: ["shop.de"], removed: ["shop.fr"] },
  );
});

test("reports no changes when the host set is the same", () => {
  assert.deepEqual(
    diffStorefrontHosts(["shop.com", "shop.de"], ["shop.de", "shop.com"]),
    { added: [], removed: [] },
  );
});
