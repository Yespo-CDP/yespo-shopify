import type { GraphQLClient } from "@shopify/graphql-client";
import { stripHtml } from "string-strip-html";
import type {
  ProductTranslation,
  ProductTranslationCategory,
} from "~/@types/product";

const MAX_DESCRIPTION_LENGTH = 9500;

export interface ProductTranslationsResult {
  /** locale → ProductTranslation (product-level: name, description, url) */
  product: Record<string, ProductTranslation>;
  /** strippedVariantId → locale → translated variant title */
  variants: Record<string, Record<string, string>>;
}

const VARIANT_BATCH_SIZE = 50;

/**
 * Fetches product-level, collection-category, and variant translations for all
 * provided secondary locales and returns a single structured result ready for
 * the Yespo `translations` payload field.
 *
 * ─── GraphQL requests made ───────────────────────────────────────────────────
 *
 * Request 1 — product-level (1 request, always):
 *   Fetches `title` and `body_html` translations per locale via inline aliases.
 *
 *   Query shape:
 *     product(id: $productId) {
 *       p_uk: translations(locale: "uk") { key value }
 *       p_fr: translations(locale: "fr") { key value }
 *     }
 *
 *   Locale is SKIPPED entirely if Shopify returns no translated `title` for it.
 *
 * Request 2 — collection categories (1 batched request, only when collections
 *   are provided AND at least one locale survived request 1):
 *   Fetches translated collection titles for every collection × locale pair via
 *   top-level aliases. Falls back to the original collection name when no
 *   translation is found for a given locale.
 *
 *   Query shape (2 collections × 2 locales = 4 aliases):
 *     query getCollectionTranslations {
 *       c_123_uk: collection(id: "gid://shopify/Collection/123") {
 *         translations(locale: "uk") { key value }
 *       }
 *       c_123_fr: collection(id: "gid://shopify/Collection/123") {
 *         translations(locale: "fr") { key value }
 *       }
 *       c_456_uk: collection(id: "gid://shopify/Collection/456") {
 *         translations(locale: "uk") { key value }
 *       }
 *       c_456_fr: collection(id: "gid://shopify/Collection/456") {
 *         translations(locale: "fr") { key value }
 *       }
 *     }
 *
 * Request 3 — variant titles (⌈variants / 50⌉ requests):
 *   Fetches `title` translations per variant per locale in batches of 50.
 *   Using top-level `productVariant(id: $vN)` aliases avoids Shopify's
 *   inline `variants(first: 100)` limit.
 *
 *   Query shape (batch of 2 variants × 2 locales = 4 locale aliases):
 *     query getVariantTranslations($v0: ID!, $v1: ID!) {
 *       v0: productVariant(id: $v0) {
 *         id
 *         v0_uk: translations(locale: "uk") { key value }
 *         v0_fr: translations(locale: "fr") { key value }
 *       }
 *       v1: productVariant(id: $v1) {
 *         id
 *         v1_uk: translations(locale: "uk") { key value }
 *         v1_fr: translations(locale: "fr") { key value }
 *       }
 *     }
 *
 * ─── Input example ───────────────────────────────────────────────────────────
 *
 *   productId:     "gid://shopify/Product/987"
 *   variantGids:   ["gid://shopify/ProductVariant/111", "gid://shopify/ProductVariant/222"]
 *   locales:       ["uk", "fr"]
 *   shopDomain:    "mystore.com"
 *   productHandle: "t-shirt"
 *   collections:   [
 *     { id: "gid://shopify/Collection/123", name: "Clothing" },
 *     { id: "456", name: "Tops" }                              // numeric ID also accepted
 *   ]
 *
 * ─── Output example ──────────────────────────────────────────────────────────
 *
 *   {
 *     product: {
 *       "uk": {
 *         name: "Футболка",
 *         description: "Зручна футболка з бавовни.",
 *         url: "https://mystore.com/uk/products/t-shirt",
 *         categories: [
 *           { id: "123", name: "Одяг",  type: "collection" }, // translated
 *           { id: "456", name: "Tops",  type: "collection" }  // fallback (no uk translation)
 *         ]
 *       },
 *       "fr": {
 *         name: "T-shirt",
 *         url: "https://mystore.com/fr/products/t-shirt",
 *         categories: [
 *           { id: "123", name: "Vêtements", type: "collection" },
 *           { id: "456", name: "Hauts",     type: "collection" }
 *         ]
 *       }
 *     },
 *     variants: {
 *       "111": { "uk": "Чорна", "fr": "Noir" },
 *       "222": { "uk": "Біла" }                // fr absent — no translation found
 *     }
 *   }
 *
 * ─── Parameters ──────────────────────────────────────────────────────────────
 *
 * @param client        - Shopify Admin GraphQL client
 * @param productId     - Shopify product GID
 * @param variantGids   - All variant GIDs for the product (caller handles pagination)
 * @param locales       - Secondary (non-primary) locale codes, e.g. ["uk", "fr"]
 * @param shopDomain    - Shop domain used to build translated product URLs
 * @param productHandle - Product handle used to build translated product URLs
 * @param collections   - Collections to include as translated categories. Accepts
 *                        either Shopify GIDs or plain numeric IDs; original `name`
 *                        is used as fallback when no translation exists for a locale.
 */
export const getProductTranslations = async ({
  client,
  productId,
  variantGids,
  locales,
  shopDomain,
  productHandle,
  collections = [],
}: {
  client: GraphQLClient;
  productId: string;
  variantGids: string[];
  locales: string[];
  shopDomain: string;
  productHandle: string;
  collections?: Array<{ id: string; name: string }>;
}): Promise<ProductTranslationsResult> => {
  const empty: ProductTranslationsResult = { product: {}, variants: {} };
  if (!locales.length) return empty;

  try {
    // ── Request 1: product-level translations ─────────────────────────────
    // One alias per locale, e.g.:
    //   p_uk: translations(locale: "uk") { key value }
    //   p_fr: translations(locale: "fr") { key value }
    const productAliases = locales
      .map(
        (locale) =>
          `p_${locale.replace("-", "_")}: translations(locale: "${locale}") { key value }`,
      )
      .join("\n          ");

    const productResponse = await client.request(
      `query getProductTranslations($productId: ID!) {
        product(id: $productId) {
          ${productAliases}
        }
      }`,
      { variables: { productId } },
    );

    const productData = (productResponse?.data as any)?.product ?? {};
    const productResult: Record<string, ProductTranslation> = {};

    for (const locale of locales) {
      const safeLocale = locale.replace("-", "_");
      // Shopify returns an array of { key, value } pairs per locale.
      // Relevant keys: "title" → name, "body_html" → description.
      const entries: Array<{ key: string; value: string }> =
        productData[`p_${safeLocale}`] ?? [];

      const translation: ProductTranslation = {};
      for (const { key, value } of entries) {
        if (key === "title" && value) translation.name = value;
        if (key === "body_html" && value) {
          translation.description = stripHtml(value)
            .result.replace(/\s{2,}/g, " ")
            .trim()
            .substring(0, MAX_DESCRIPTION_LENGTH);
        }
      }

      // Skip this locale entirely if there is no translated product title —
      // a translation without a name is useless for Yespo.
      if (!translation.name) continue;

      translation.url = shopDomain
        ? `https://${shopDomain}/${locale}/products/${productHandle}`
        : undefined;

      productResult[locale] = translation;
    }

    // ── Request 2: collection category translations (batched) ─────────────
    // Only executed when:
    //   a) at least one collection was passed, AND
    //   b) at least one locale survived the name-check above.
    //
    // Builds one top-level alias per (collection × locale) pair so that
    // all collection translations are resolved in a single GraphQL round-trip.
    //
    // Alias naming: c_{numericId}_{safeLocale}
    // e.g. c_123_uk, c_123_fr, c_456_uk, c_456_fr
    //
    // IDs are normalised: "123" → "gid://shopify/Collection/123" for the query,
    // "gid://shopify/Collection/123" → "123" for the Yespo category `id` field.
    if (collections.length > 0 && Object.keys(productResult).length > 0) {
      const normalise = (id: string) =>
        id.includes("/") ? id : `gid://shopify/Collection/${id}`;
      const numeric = (id: string) => id.split("/").pop() ?? id;
      const safeAlias = (id: string, locale: string) =>
        `c_${numeric(id)}_${locale.replace(/[^a-zA-Z0-9]/g, "_")}`;

      const collectionAliases = collections
        .flatMap((col) =>
          Object.keys(productResult).map(
            (locale) =>
              `${safeAlias(col.id, locale)}: collection(id: "${normalise(col.id)}") {
                translations(locale: "${locale}") { key value }
              }`,
          ),
        )
        .join("\n        ");

      const colResponse: any = await client.request(
        `query getCollectionTranslations { ${collectionAliases} }`,
      );
      const colData: any = colResponse?.data ?? {};

      // Build: numericCollectionId → locale → translatedTitle
      const colTranslations = new Map<string, Map<string, string>>();
      for (const col of collections) {
        const localeMap = new Map<string, string>();
        for (const locale of Object.keys(productResult)) {
          const entries: Array<{ key: string; value: string }> =
            colData[safeAlias(col.id, locale)]?.translations ?? [];
          const translatedTitle = entries.find((e) => e.key === "title")?.value;
          // Only store when Shopify actually has a translation; otherwise we
          // fall back to col.name when building categories below.
          if (translatedTitle) localeMap.set(locale, translatedTitle);
        }
        colTranslations.set(numeric(col.id), localeMap);
      }

      // Attach translated categories to each locale's ProductTranslation.
      // Example result for locale "uk":
      //   categories: [
      //     { id: "123", name: "Одяг",  type: "collection" }, ← translated
      //     { id: "456", name: "Tops",  type: "collection" }  ← fallback (no uk translation)
      //   ]
      for (const locale of Object.keys(productResult)) {
        const cats: ProductTranslationCategory[] = collections.map((col) => ({
          id: numeric(col.id),
          name: colTranslations.get(numeric(col.id))?.get(locale) ?? col.name,
          type: "collection" as const,
        }));
        productResult[locale].categories = cats;
      }
    }

    if (!variantGids.length) {
      return { product: productResult, variants: {} };
    }

    // ── Request 3: variant title translations (batched, ≤50 per request) ──
    // Shopify's inline variants(first: N) is capped at 100, so we use
    // top-level productVariant(id: $vN) aliases instead — no limit.
    //
    // Alias naming per variant: v{globalIndex}
    // Alias naming per locale:  v{globalIndex}_{safeLocale}
    // e.g. for variant index 0, locale "uk": v0, v0_uk
    const variantResult: Record<string, Record<string, string>> = {};

    const localeAliasesForVariant = (safeId: string) =>
      locales
        .map(
          (locale) =>
            `${safeId}_${locale.replace("-", "_")}: translations(locale: "${locale}") { key value }`,
        )
        .join("\n        ");

    for (
      let offset = 0;
      offset < variantGids.length;
      offset += VARIANT_BATCH_SIZE
    ) {
      const batch = variantGids.slice(offset, offset + VARIANT_BATCH_SIZE);

      const varDefs = batch.map((_, i) => `$v${offset + i}: ID!`).join(", ");

      const variantAliases = batch
        .map((_, i) => {
          const safeId = `v${offset + i}`;
          return `${safeId}: productVariant(id: $${safeId}) {
        id
        ${localeAliasesForVariant(safeId)}
      }`;
        })
        .join("\n      ");

      const varValues: Record<string, string> = {};
      batch.forEach((gid, i) => {
        varValues[`v${offset + i}`] = gid;
      });

      const batchResponse = await client.request(
        `query getVariantTranslations(${varDefs}) {
          ${variantAliases}
        }`,
        { variables: varValues },
      );

      const batchData = (batchResponse?.data as any) ?? {};

      batch.forEach((gid, i) => {
        const aliasKey = `v${offset + i}`;
        const node = batchData[aliasKey];
        if (!node) return;

        // Yespo uses numeric variant IDs; strip the GID prefix.
        const strippedId: string = gid.split("/").pop() ?? gid;

        for (const locale of locales) {
          const safeLocale = locale.replace("-", "_");
          const entries: Array<{ key: string; value: string }> =
            node[`${aliasKey}_${safeLocale}`] ?? [];
          const translatedTitle = entries.find((e) => e.key === "title")?.value;

          // Only record locales that actually have a translation.
          if (translatedTitle) {
            (variantResult[strippedId] ??= {})[locale] = translatedTitle;
          }
        }
      });
    }

    return { product: productResult, variants: variantResult };
  } catch (error) {
    console.error(
      "[translations] Failed to fetch product translations:",
      error,
    );
    return empty;
  }
};
