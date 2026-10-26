import assert from "node:assert/strict";
import test from "node:test";

import {
  contactMarketId,
  readContactMarketContext,
  readMarketId,
  resolveContactMarketId,
  shouldEnableMarketSync,
} from "./market-tracking";

test("enables market sync when the shop has at least one market", () => {
  assert.equal(shouldEnableMarketSync(2), true);
  assert.equal(shouldEnableMarketSync(1), true);
  assert.equal(shouldEnableMarketSync(0), false);
});

test("uses the customer country as marketId for any shop", () => {
  assert.equal(contactMarketId("UA"), "ua");
  assert.equal(contactMarketId(" ua "), "ua");
  assert.equal(contactMarketId(null), undefined);
  assert.equal(contactMarketId(""), undefined);
});

const shopMarkets = {
  marketCountryCodes: ["ua", "pl"],
  backupRegionCode: "ua",
};

test("keeps an address country that belongs to an enabled market", () => {
  assert.equal(
    resolveContactMarketId({
      countryCode: "PL",
      marketContext: shopMarkets,
      whenCountryMissing: "backup",
    }),
    "pl",
  );
});

test("uses the backup region when the address country is not a shop market", () => {
  assert.equal(
    resolveContactMarketId({
      countryCode: "DE",
      marketContext: shopMarkets,
      whenCountryMissing: "omit",
    }),
    "ua",
  );
});

test("uses the backup region when a new contact has no country", () => {
  assert.equal(
    resolveContactMarketId({
      countryCode: null,
      marketContext: shopMarkets,
      whenCountryMissing: "backup",
    }),
    "ua",
  );
});

test("omits marketId when an updated contact has no country", () => {
  assert.equal(
    resolveContactMarketId({
      countryCode: null,
      marketContext: shopMarkets,
      whenCountryMissing: "omit",
    }),
    undefined,
  );
});

test("omits marketId when the address country is unknown and backup region is missing", () => {
  assert.equal(
    resolveContactMarketId({
      countryCode: "DE",
      marketContext: { marketCountryCodes: ["ua"], backupRegionCode: null },
      whenCountryMissing: "backup",
    }),
    undefined,
  );
});

test("keeps the address country when shop markets could not be loaded", () => {
  assert.equal(
    resolveContactMarketId({
      countryCode: "DE",
      marketContext: null,
      whenCountryMissing: "backup",
    }),
    "de",
  );
  assert.equal(
    resolveContactMarketId({
      countryCode: null,
      marketContext: null,
      whenCountryMissing: "backup",
    }),
    undefined,
  );
});

test("reads enabled market countries and the backup region", () => {
  assert.deepEqual(
    readContactMarketContext({
      backupRegion: { code: "UA" },
      markets: {
        nodes: [
          {
            enabled: true,
            regions: { nodes: [{ code: "UA" }, { code: "PL" }] },
          },
          {
            enabled: false,
            regions: { nodes: [{ code: "DE" }] },
          },
        ],
      },
    }),
    { marketCountryCodes: ["ua", "pl"], backupRegionCode: "ua" },
  );
});

test("treats a markets payload without a markets list as unread", () => {
  assert.equal(readContactMarketContext(null), null);
  assert.equal(readContactMarketContext({}), null);
});

test("keeps a lowercase market id and rejects anything else", () => {
  assert.equal(readMarketId("UA"), "ua");
  assert.equal(readMarketId(" lviv_center-2 "), "lviv_center-2");
  assert.equal(readMarketId(""), null);
  assert.equal(readMarketId("ua/kyiv"), null);
  assert.equal(readMarketId(null), null);
});
