import assert from "node:assert/strict";
import test from "node:test";

import type { CustomerData } from "~/@types/customer";
import { createContactPayload } from "./create-contact-payload";

function customer(countryCode?: string): CustomerData {
  return {
    id: "gid://shopify/Customer/1",
    lastName: "Doe",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...(countryCode
      ? { defaultAddress: { id: "addr", countryCodeV2: countryCode } }
      : {}),
  };
}

test("sets marketId from the customer's default address country", () => {
  const contact = createContactPayload(customer("DE"));
  assert.equal(contact.marketId, "de");
});

test("omits marketId when the customer has no default address country", () => {
  const contact = createContactPayload(customer());
  assert.equal(contact.marketId, undefined);
});

test("replaces a country outside the shop markets with the backup region", () => {
  const contact = createContactPayload(customer("DE"), {
    marketCountryCodes: ["ua"],
    backupRegionCode: "ua",
  });
  assert.equal(contact.marketId, "ua");
});

test("omits marketId on bulk update when the customer has no country", () => {
  const contact = createContactPayload(customer(), {
    marketCountryCodes: ["ua"],
    backupRegionCode: "ua",
  });
  assert.equal(contact.marketId, undefined);
});
