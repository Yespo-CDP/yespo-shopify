import assert from "node:assert/strict";
import test from "node:test";

import type { ShopMarketsConfig } from "~/@types/shopMarketsConfig";

import { selectMarketsForSync } from "./select-markets-for-sync";

const config: ShopMarketsConfig = {
  markets: [
    {
      id: "gid://shopify/Market/1",
      name: "Ukraine",
      handle: "ua",
      enabled: true,
      countries: ["UA"],
      locales: ["uk"],
      rootUrls: { uk: "https://shop.example/uk" },
      catalogPublicationIds: ["gid://shopify/Publication/1"],
    },
    {
      id: "gid://shopify/Market/2",
      name: "North America",
      handle: "na",
      enabled: true,
      countries: ["US", "CA"],
      locales: ["en"],
      rootUrls: { en: "https://shop.example" },
      catalogPublicationIds: ["gid://shopify/Publication/2"],
    },
  ],
  countries: ["UA", "US", "CA"],
  locales: ["uk", "en"],
};

test("keeps only the created market and its countries", () => {
  const selected = selectMarketsForSync(config, "gid://shopify/Market/2");

  assert.deepEqual(
    selected?.markets.map((market) => market.id),
    ["gid://shopify/Market/2"],
  );
  assert.deepEqual(selected?.countries, ["US", "CA"]);
});

test("matches a numeric id against the stored Market gid", () => {
  const selected = selectMarketsForSync(config, "2");
  assert.equal(selected?.markets[0]?.handle, "na");
});

test("returns null when the created market is not enabled", () => {
  assert.equal(selectMarketsForSync(config, "gid://shopify/Market/9"), null);
});
