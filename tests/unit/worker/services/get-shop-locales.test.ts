import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import type { GraphQLClient } from "@shopify/graphql-client";

const { getShopLanguages } = await import(
  "../../../../app/worker/services/get-shop-locales"
);

const locale = (code: string, primary = false, published = true) => ({
  locale: code,
  primary,
  published,
});
const uk = locale("uk", true);
const accessDenied = {
  message: "GraphQL Client: An error occurred while fetching from the API",
  graphQLErrors: [{ message: "Access denied for shopLocales field" }],
};

let sentQuery = "";
const logError = mock.method(console, "error", () => {});

const run = (response: unknown, storedLanguageCode: string | null) => {
  const request = async (query: string) => {
    sentQuery = query;
    if (response instanceof Error) throw response;
    return response;
  };
  return getShopLanguages({
    client: { request } as unknown as GraphQLClient,
    storedLanguageCode,
  });
};

beforeEach(() => logError.mock.resetCalls());

const resolved = [
  { name: "primary only", locales: [uk], stored: null, expected: ["uk", []] },
  { name: "primary and a secondary", locales: [uk, locale("en")], stored: null, expected: ["uk", ["en"]] },
  { name: "an unpublished locale is skipped", locales: [uk, locale("en"), locale("pl", false, false)], stored: null, expected: ["uk", ["en"]] },
  { name: "an empty stored language counts as none", locales: [uk, locale("en")], stored: "", expected: ["uk", ["en"]] },
  { name: "the stored language wins over the primary", locales: [uk, locale("pl")], stored: "en", expected: ["en", ["pl"]] },
  { name: "the stored language is not translated", locales: [uk, locale("en")], stored: "en", expected: ["en", []] },
] as const;

for (const { name, locales, stored, expected } of resolved) {
  test(`languages: ${name}`, async () => {
    const result = await run({ data: { shopLocales: locales } }, stored);

    assert.match(
      sentQuery.replace(/\s+/g, " "),
      /shopLocales \{ locale primary published \}/,
    );
    assert.deepEqual(result, {
      languageCode: expected[0],
      secondaryLocales: expected[1],
    });
    assert.equal(logError.mock.callCount(), 0);
  });
}

const failures = [
  { name: "errors without data", response: { errors: accessDenied } },
  {
    name: "errors with partial data",
    response: {
      errors: accessDenied,
      data: { shopLocales: [locale("de", true), locale("fr")] },
    },
  },
  { name: "a thrown error", response: new Error("network down") },
  { name: "no primary locale", response: { data: { shopLocales: [locale("fr")] } } },
  { name: "null data", response: { data: null } },
];

for (const { name, response } of failures) {
  for (const { stored, expected } of [
    { stored: null, expected: "en" },
    { stored: "", expected: "en" },
    { stored: "uk", expected: "uk" },
  ]) {
    test(`failure: ${name}, stored ${JSON.stringify(stored)} → ${expected}`, async () => {
      const result = await run(response, stored);

      assert.deepEqual(result, { languageCode: expected, secondaryLocales: [] });
      assert.equal(logError.mock.callCount(), 1);
    });
  }
}
