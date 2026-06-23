import type { ProductData, ProductVariantData } from "~/@types/product";
import type { ProductVariant, YespoCategory } from "~/@types/productVariant";

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
 * Maps Shopify collections to Yespo category objects.
 * Shopify collections are flat (no hierarchy), so they map to type "collection".
 */
function mapCollections(
  nodes?: Array<{ id: string; title: string; handle: string }>,
): YespoCategory[] {
  if (!nodes?.length) return [];
  return nodes.map((node) => ({
    id: node.id.split("/").pop() ?? node.id,
    name: node.title,
    type: "collection" as const,
  }));
}

/**
 * Converts Shopify product and variant data into a Yespo product payload.
 *
 * @param product - Shopify product node from GraphQL
 * @param variant - Shopify variant node from GraphQL
 * @param shopCurrency - Fallback ISO 4217 currency code from shop settings
 * @param shopDomain - Shop domain used to construct product URL when onlineStoreUrl is null
 * @param action - "create" for new variants, "update" for previously synced ones
 */
export const createProductVariantPayload = (
  product: ProductData,
  variant: ProductVariantData,
  shopCurrency = "",
  shopDomain = "",
  action: "create" | "update" = "create",
): ProductVariant => {
  const variantTitle =
    variant.title === "Default Title" ? "" : variant.title.trim();
  const name = variantTitle
    ? `${product.title} - ${variantTitle}`
    : product.title;

  const imageUrl =
    variant.image?.url ?? product.featuredImage?.url ?? "";

  const url =
    product.onlineStoreUrl ??
    (shopDomain && product.handle
      ? `https://${shopDomain}/products/${product.handle}`
      : "");

  const currency =
    variant.contextualPricing?.price?.currencyCode ?? shopCurrency;

  const isInStock: 0 | 1 =
    variant.inventoryQuantity == null || variant.inventoryQuantity > 0 ? 1 : 0;

  const categories = mapCollections(product.collections?.nodes);

  const itemGroupId = product.id.split("/").pop() ?? product.id;
  const productId = variant.id.split("/").pop() ?? variant.id;

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

  return payload;
};
