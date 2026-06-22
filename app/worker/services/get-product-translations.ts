import type { GraphQLClient } from "@shopify/graphql-client";
import type { ProductTranslation } from "~/@types/product";

export interface ProductTranslationsResult {
  /** locale → ProductTranslation (product-level: name, description, url) */
  product: Record<string, ProductTranslation>;
  /** strippedVariantId → locale → translated variant title */
  variants: Record<string, Record<string, string>>;
}

const VARIANT_BATCH_SIZE = 50;

/**
 * Fetches product AND variant translations for all provided locales.
 *
 * Two requests are made:
 * 1. One query for product-level translations (title, body_html).
 * 2. N batched queries for variant translations using top-level aliases,
 *    VARIANT_BATCH_SIZE variants per batch. This correctly handles products
 *    with more than 100 variants (Shopify's inline `variants(first:)` limit).
 *
 * Shopify translation keys:
 *   - product  "title"     → ProductTranslation.name
 *   - product  "body_html" → ProductTranslation.description (HTML stripped)
 *   - variant  "title"     → variants[strippedId][locale]
 *
 * @param client - Shopify GraphQL Admin API client
 * @param productId - Shopify product GID (e.g. "gid://shopify/Product/123")
 * @param variantGids - All variant GIDs for the product (already paginated by caller)
 * @param locales - Non-primary locale codes (e.g. ["uk", "fr"])
 * @param shopDomain - Shop domain for constructing translated URLs
 * @param productHandle - Product handle for constructing translated URLs
 * @param collections - Reserved for future collection-translation support
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
  collections?: Array<{ id: string; title: string; handle: string }>;
}): Promise<ProductTranslationsResult> => {
  void collections;

  const empty: ProductTranslationsResult = { product: {}, variants: {} };
  if (!locales.length) return empty;

  try {
    // ── 1. Product-level translations ──────────────────────────────────────
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
      const entries: Array<{ key: string; value: string }> =
        productData[`p_${safeLocale}`] ?? [];

      const translation: ProductTranslation = {};
      for (const { key, value } of entries) {
        if (key === "title" && value) translation.name = value;
        if (key === "body_html" && value) {
          translation.description = value
            .replace(/<[^>]*>/g, " ")
            .replace(/\s{2,}/g, " ")
            .trim()
            .substring(0, 10000);
        }
      }

      if (!translation.name) continue;

      translation.url = shopDomain
        ? `https://${shopDomain}/${locale}/products/${productHandle}`
        : undefined;

      productResult[locale] = translation;
    }

    if (!variantGids.length) {
      return { product: productResult, variants: {} };
    }

    // ── 2. Variant translations — batched ──────────────────────────────────
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

      // Build variable definitions and aliases for this batch
      const varDefs = batch
        .map((_, i) => `$v${offset + i}: ID!`)
        .join(", ");

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

        const strippedId: string = gid.split("/").pop() ?? gid;

        for (const locale of locales) {
          const safeLocale = locale.replace("-", "_");
          const entries: Array<{ key: string; value: string }> =
            node[`${aliasKey}_${safeLocale}`] ?? [];
          const translatedTitle = entries.find(
            (e) => e.key === "title",
          )?.value;

          if (translatedTitle) {
            (variantResult[strippedId] ??= {})[locale] = translatedTitle;
          }
        }
      });
    }

    return { product: productResult, variants: variantResult };
  } catch (error) {
    console.error("[translations] Failed to fetch product translations:", error);
    return empty;
  }
};
