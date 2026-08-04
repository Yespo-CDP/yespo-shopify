import type { ProductData, ProductVariantData } from "~/@types/product";
import type {
  ProductRemovePatch,
  ProductVariant,
} from "~/@types/productVariant";
import {
  mapShopifyCategories,
  withDefaultCategory,
} from "~/worker/services/map-yespo-categories";
import { appendVariantParam } from "~/worker/services/append-variant-param";

/**
 * Builds Yespo tags from variant selectedOptions.
 *
 * Each option becomes a key with the variant's specific value as a single-element array.
 *
 * Example: selectedOptions = [{ name: "Color", value: "Black" }, { name: "Size", value: "M" }]
 *   → { "Color": ["Black"], "Size": ["M"] }
 */
function mapSelectedOptions(
  selectedOptions: Array<{ name: string; value: string }>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const { name, value } of selectedOptions) {
    if (name && value && value !== "Default Title") {
      result[name] = [value];
    }
  }
  return result;
}

/**
 * Converts Shopify product and variant data into a Yespo product payload.
 *
 * @param product - Shopify product node from GraphQL
 * @param variant - Shopify variant node from GraphQL
 * @param shopCurrency - Fallback ISO 4217 currency code from shop settings
 * @param shopDomain - Shop domain used to construct product URL when onlineStoreUrl is null
 * @param action - "create" for new variants, "update" for previously synced ones
 * @param previousTagKeys - Tag keys that were sent in the previous sync (from ProductVariantSync.syncedTagKeys)
 * @param removedLocales - Secondary locales removed from the shop since last sync (from Shop.syncedLocales diff)
 */
export const createProductVariantPayload = (
  product: ProductData,
  variant: ProductVariantData,
  shopCurrency = "",
  shopDomain = "",
  action: "create" | "update" = "create",
  previousTagKeys: string[] = [],
  removedLocales: string[] = [],
): ProductVariant => {
  const variantTitle =
    variant.title === "Default Title" ? "" : variant.title.trim();
  const name = variantTitle
    ? `${product.title} - ${variantTitle}`
    : product.title;

  const imageUrl =
    variant.image?.url ?? product.featuredImage?.url ?? "";

  const productId = variant.id.split("/").pop() ?? variant.id;

  const baseUrl =
    product.onlineStoreUrl ??
    (shopDomain && product.handle
      ? `https://${shopDomain}/products/${product.handle}`
      : "");
  const url = appendVariantParam(baseUrl, productId);

  const currency =
    variant.contextualPricing?.price?.currencyCode ?? shopCurrency;

  const isInStock: 0 | 1 =
    variant.inventoryQuantity == null || variant.inventoryQuantity > 0 ? 1 : 0;

  const mappedCategories = mapShopifyCategories({
    collections: product.collections?.nodes,
    category: product.category,
  });
  if (mappedCategories.length === 0) {
    console.warn(
      `Product ${productId} has no collections or taxonomy category; falling back to default "Uncategorized" category`,
    );
  }
  const categories = withDefaultCategory(mappedCategories);

  const itemGroupId = product.id.split("/").pop() ?? product.id;

  const payload: ProductVariant = {
    action,
    productId,
    updatedDate: variant.updatedAt,
    name,
    imageUrl,
    url,
    isInStock,
    price: parseFloat(variant.price ?? "0"),
    currency,
    categories,
    itemGroupId,
  };

  if (product.vendor) {
    payload.brand = product.vendor;
  }

  if (product.description) {
    payload.description = product.description.substring(0, 10000);
  }

  const compareAtPrice = parseFloat(variant.compareAtPrice ?? "0");
  const price = parseFloat(variant.price ?? "0");
  if (compareAtPrice > price) {
    payload.oldPrice = compareAtPrice;
  }

  const tags = mapSelectedOptions(variant.selectedOptions ?? []);
  if (Object.keys(tags).length > 0) {
    payload.tags = tags;
  }

  if (product.translations && Object.keys(product.translations).length > 0) {
    payload.translations = Object.entries(product.translations).map(
      ([locale, t]) => {
        // Use translated variant title if available for this variant + locale,
        // otherwise fall back to the original variant option title.
        const translatedVariantTitle =
          product.variantTranslations?.[productId]?.[locale] ?? variantTitle;

        return {
          [locale]: {
            ...t,
            url: t.url ? appendVariantParam(t.url, productId) : t.url,
            name: t.name
              ? translatedVariantTitle
                ? `${t.name} - ${translatedVariantTitle}`
                : t.name
              : undefined,
          },
        };
      },
    );
  }

  // For update operations: explicitly remove fields/keys no longer present in Shopify.
  // Yespo ignores null — only `remove` clears values.
  if (action === "update") {
    const remove: ProductRemovePatch = {};

    // Scalar fields: absence in current Shopify data means "remove from Yespo".
    const removeFields: ProductRemovePatch["fields"] = [];
    if (!payload.oldPrice) removeFields.push("oldPrice");
    if (!payload.description) removeFields.push("description");
    if (!payload.brand) removeFields.push("brand");
    if (removeFields.length > 0) remove.fields = removeFields;

    // Tags: keys present in previous sync but absent in current selectedOptions.
    const currentTagKeys = Object.keys(payload.tags ?? {});
    const removedTagKeys = previousTagKeys.filter(
      (k) => !currentTagKeys.includes(k),
    );
    if (removedTagKeys.length > 0) remove.tags = removedTagKeys;

    // Translations: locales removed from the shop since last sync.
    if (removedLocales.length > 0) remove.translations = removedLocales;

    if (
      remove.fields?.length ||
      remove.tags?.length ||
      remove.translations?.length
    ) {
      payload.remove = remove;
    }
  }

  return payload;
};
