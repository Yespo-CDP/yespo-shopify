import assert from "node:assert/strict";
import test from "node:test";

import type { ShopMarketConfig } from "~/@types/shopMarketsConfig";

import {
  activeCatalogPublicationIds,
  isPublishedOnMarketCatalog,
  marketsMissingActiveCatalog,
} from "./market-catalogs";

const UA_PUBLICATION = "gid://shopify/Publication/10";
const US_PUBLICATION = "gid://shopify/Publication/20";

function market(
  overrides: Partial<ShopMarketConfig> & Pick<ShopMarketConfig, "id" | "name">,
): ShopMarketConfig {
  return {
    handle: overrides.name.toLowerCase(),
    enabled: true,
    countries: [],
    locales: [],
    rootUrls: {},
    catalogPublicationIds: [],
    ...overrides,
  };
}

test("keeps publication ids of active catalogs only", () => {
  assert.deepEqual(
    activeCatalogPublicationIds([
      {
        status: "ACTIVE",
        publication: { id: UA_PUBLICATION },
      },
      {
        status: "ACTIVE",
        publication: { id: US_PUBLICATION },
      },
      {
        status: "DRAFT",
        publication: { id: "gid://shopify/Publication/30" },
      },
      {
        status: "ARCHIVED",
        publication: { id: "gid://shopify/Publication/40" },
      },
      { status: "ACTIVE", publication: null },
      { status: "ACTIVE", publication: { id: UA_PUBLICATION } },
    ]),
    [UA_PUBLICATION, US_PUBLICATION],
  );
});

test("names every market that has no active catalog publication", () => {
  const ukraine = market({
    id: "gid://shopify/Market/1",
    name: "Ukraine",
    countries: ["UA"],
    catalogPublicationIds: [UA_PUBLICATION],
  });
  const germany = market({
    id: "gid://shopify/Market/2",
    name: "Germany",
    countries: ["DE"],
  });

  assert.deepEqual(marketsMissingActiveCatalog([ukraine, germany]), [germany]);
  assert.deepEqual(marketsMissingActiveCatalog([ukraine]), []);
});

test("a product is in the market when it is on any attached catalog", () => {
  assert.equal(
    isPublishedOnMarketCatalog(
      { [UA_PUBLICATION]: false, [US_PUBLICATION]: true },
      [UA_PUBLICATION, US_PUBLICATION],
    ),
    true,
  );
  assert.equal(
    isPublishedOnMarketCatalog({ [UA_PUBLICATION]: false }, [UA_PUBLICATION]),
    false,
  );
  assert.equal(isPublishedOnMarketCatalog({}, []), false);
});
