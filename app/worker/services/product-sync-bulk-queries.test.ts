import assert from "node:assert/strict";
import test from "node:test";

import type { ShopMarketsConfig } from "~/@types/shopMarketsConfig";

import { buildBulkPricingQuery } from "./product-sync-bulk-queries";

const config: ShopMarketsConfig = {
  markets: [
    {
      id: "gid://shopify/Market/1",
      name: "Ukraine",
      handle: "ua",
      enabled: true,
      countries: ["UA"],
      locales: ["uk"],
      rootUrls: {},
      catalogPublicationIds: ["gid://shopify/Publication/10"],
    },
    {
      id: "gid://shopify/Market/2",
      name: "United States",
      handle: "us",
      enabled: true,
      countries: ["US"],
      locales: ["en"],
      rootUrls: {},
      catalogPublicationIds: [
        "gid://shopify/Publication/20",
        "gid://shopify/Publication/21",
      ],
    },
  ],
  countries: ["UA", "US"],
  locales: ["uk", "en"],
};

test("a market without a catalog asks for the online store assortment and the country price", () => {
  const query = buildBulkPricingQuery(
    {
      markets: [
        {
          id: "gid://shopify/Market/3",
          name: "Germany",
          handle: "de",
          enabled: true,
          countries: ["DE"],
          locales: ["de"],
          rootUrls: {},
          catalogPublicationIds: [],
        },
      ],
      countries: ["DE"],
      locales: ["de"],
    },
    { countries: ["DE"] },
  );

  assert.match(query, /\n\s*status\b/);
  assert.match(query, /\bpublishedAt\b/);
  assert.match(query, /contextualPricing\(context: \{ country: DE \}\)/);
  assert.doesNotMatch(query, /publishedOnPublication/);
});

test("asks Shopify whether the product is on the market catalog", () => {
  const query = buildBulkPricingQuery(config, { countries: ["US"] });

  assert.match(
    query,
    /publishedOnPublication\(publicationId: "gid:\/\/shopify\/Publication\/20"\)/,
  );
  assert.match(
    query,
    /publishedOnPublication\(publicationId: "gid:\/\/shopify\/Publication\/21"\)/,
  );
  assert.doesNotMatch(query, /Publication\/10/);
  assert.doesNotMatch(query, /publishedInContext/);
  assert.doesNotMatch(query, /\bpublishedAt\b/);
  assert.match(query, /contextualPricing\(context: \{ country: US \}\)/);
});
