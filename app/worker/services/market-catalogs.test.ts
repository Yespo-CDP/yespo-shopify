import assert from "node:assert/strict";
import test from "node:test";

import {
  activeCatalogPublicationIds,
  isProductInMarket,
  isPublishedOnMarketCatalog,
} from "./market-catalogs";

const UA_PUBLICATION = "gid://shopify/Publication/10";
const US_PUBLICATION = "gid://shopify/Publication/20";

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

test("a market without a catalog includes active products published to the online store", () => {
  assert.equal(
    isProductInMarket({
      catalogPublicationIds: [],
      publishedByPublicationId: {},
      status: "ACTIVE",
      publishedAt: "2026-04-01T09:07:15Z",
    }),
    true,
  );
  assert.equal(
    isProductInMarket({
      catalogPublicationIds: [],
      publishedByPublicationId: {},
      status: "ACTIVE",
      publishedAt: null,
    }),
    false,
  );
  assert.equal(
    isProductInMarket({
      catalogPublicationIds: [],
      publishedByPublicationId: {},
      status: "DRAFT",
      publishedAt: "2026-04-01T09:07:15Z",
    }),
    false,
  );
});

test("a catalog still decides membership when the market has one", () => {
  assert.equal(
    isProductInMarket({
      catalogPublicationIds: [UA_PUBLICATION],
      publishedByPublicationId: { [UA_PUBLICATION]: true },
      status: "DRAFT",
      publishedAt: null,
    }),
    true,
  );
  assert.equal(
    isProductInMarket({
      catalogPublicationIds: [UA_PUBLICATION],
      publishedByPublicationId: { [UA_PUBLICATION]: false },
      status: "ACTIVE",
      publishedAt: "2026-04-01T09:07:15Z",
    }),
    false,
  );
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
