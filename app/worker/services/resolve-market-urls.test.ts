import assert from "node:assert/strict";
import test from "node:test";

import type { ShopMarketConfig } from "~/@types/shopMarketsConfig";

import {
  applyMarketClearing,
  resolveMarketUrls,
} from "./resolve-market-urls";

function market(
  locales: string[],
  rootUrls: Record<string, string>,
): ShopMarketConfig {
  return {
    id: "gid://shopify/Market/1",
    name: "Market",
    handle: "m",
    enabled: true,
    countries: ["PL"],
    locales,
    rootUrls,
    catalogPublicationIds: [],
  };
}

test("appends the variant id to every locale url", () => {
  const resolved = resolveMarketUrls(
    market(["en", "uk"], {
      en: "https://shop.example",
      uk: "https://shop.example/uk",
    }),
    "cool-socks",
    [],
    "430738",
  );

  assert.deepEqual(resolved, {
    urls: {
      en: "https://shop.example/products/cool-socks?variant=430738",
      uk: "https://shop.example/uk/products/cool-socks?variant=430738",
    },
    urlsTranslations: [],
    clearUrls: false,
  });
});

test("keeps only absolute locale urls", () => {
  const resolved = resolveMarketUrls(
    market(["en", "uk"], {
      en: "https://shop.example",
      uk: "https://shop.example/uk",
    }),
    "cool-socks",
  );

  assert.deepEqual(resolved, {
    urls: {
      en: "https://shop.example/products/cool-socks",
      uk: "https://shop.example/uk/products/cool-socks",
    },
    urlsTranslations: [],
    clearUrls: false,
  });
});

test("names locales that have no url", () => {
  const resolved = resolveMarketUrls(
    market(["en"], { en: "https://shop.example/en-de" }),
    "cool-socks",
    ["en", "fr"],
  );

  assert.deepEqual(resolved, {
    urls: { en: "https://shop.example/en-de/products/cool-socks" },
    urlsTranslations: ["fr"],
    clearUrls: false,
  });
});

test("lists every locale when none has a url", () => {
  const resolved = resolveMarketUrls(
    market(["pl"], {}),
    "cool-socks",
  );

  assert.deepEqual(resolved, {
    urlsTranslations: ["pl"],
    clearUrls: false,
  });
});

test("clears the urls field when the market has no locales", () => {
  const resolved = resolveMarketUrls(market([], {}), "cool-socks");

  assert.deepEqual(resolved, {
    urlsTranslations: [],
    clearUrls: true,
  });
});

test("missing oldPrice goes to remove.fields and null urls do not", () => {
  const patch = applyMarketClearing({
    price: 14,
    compareAt: 0,
    resolved: resolveMarketUrls(
      market(["en"], { en: "https://shop.example" }),
      "cool-socks",
      ["en", "de"],
    ),
  });

  assert.deepEqual(patch, {
    urls: { en: "https://shop.example/products/cool-socks" },
    remove: {
      fields: ["oldPrice"],
      urlsTranslations: ["de"],
    },
  });
});

test("valid oldPrice stays a number and a market with no locales clears urls", () => {
  const patch = applyMarketClearing({
    price: 14,
    compareAt: 20,
    resolved: resolveMarketUrls(market([], {}), "cool-socks"),
  });

  assert.deepEqual(patch, {
    oldPrice: 20,
    remove: { fields: ["urls"] },
  });
});

test("full urls and a valid oldPrice send no remove", () => {
  const patch = applyMarketClearing({
    price: 3.95,
    compareAt: 5,
    resolved: resolveMarketUrls(
      market(["en"], { en: "https://shop.example/en-de" }),
      "cool-socks",
    ),
  });

  assert.deepEqual(patch, {
    oldPrice: 5,
    urls: { en: "https://shop.example/en-de/products/cool-socks" },
  });
});
