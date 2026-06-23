import type { ProductVariant, YespoCategory } from "~/@types/productVariant";

export interface ProductVariantWebhookPayload {
  id: number;
  title: string;
  price: string;
  compare_at_price?: string | null;
  inventory_quantity?: number | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  admin_graphql_api_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProductWebhookPayload {
  id: number;
  title: string;
  handle: string;
  body_html?: string;
  vendor?: string;
  admin_graphql_api_id: string;
  images?: Array<{ src: string }>;
  options?: Array<{ name: string; position: number }>;
  created_at: string;
  updated_at: string;
  variants?: ProductVariantWebhookPayload[];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s{2,}/g, " ").trim();
}

/**
 * Builds Yespo tags from webhook variant option values.
 * Maps product.options[i].name → variant.option{i+1} value.
 */
function mapWebhookOptions(
  productOptions: Array<{ name: string; position: number }> | undefined,
  variant: ProductVariantWebhookPayload,
): Record<string, string[]> {
  if (!productOptions?.length) return {};
  const optionValues: (string | null | undefined)[] = [
    variant.option1,
    variant.option2,
    variant.option3,
  ];
  const result: Record<string, string[]> = {};
  for (const opt of productOptions) {
    const value = optionValues[opt.position - 1];
    if (value && value !== "Default Title") {
      result[opt.name] = [value];
    }
  }
  return result;
}

/**
 * Converts a Shopify product webhook payload into a Yespo product payload.
 *
 * Note: Shopify webhooks do not include collection data.
 * Categories will be an empty array on create — the product will be rejected
 * by Yespo unless collections are fetched via a separate API call beforehand.
 *
 * @param product - Shopify product webhook payload
 * @param variant - Shopify variant from the same webhook
 * @param shopCurrency - ISO 4217 currency code from shop settings
 * @param shopDomain - Shop domain used to construct the product URL
 * @param action - "create" for new variants, "update" for previously synced ones
 * @param categories - Pre-fetched Yespo categories (from separate API call if needed)
 */
export const createProductVariantPayloadFromWebhook = (
  product: ProductWebhookPayload,
  variant: ProductVariantWebhookPayload,
  shopCurrency = "",
  shopDomain = "",
  action: "create" | "update" = "create",
  categories: YespoCategory[] = [],
): ProductVariant => {
  const variantTitle =
    variant.title === "Default Title" ? "" : variant.title.trim();
  const name = variantTitle
    ? `${product.title} - ${variantTitle}`
    : product.title;

  const imageUrl = product.images?.[0]?.src ?? "";
  const url = shopDomain
    ? `https://${shopDomain}/products/${product.handle}`
    : "";

  const inventoryQuantity = variant.inventory_quantity;
  const isInStock: 0 | 1 =
    inventoryQuantity == null || inventoryQuantity > 0 ? 1 : 0;

  const updatedDate =
    variant.updated_at ?? product.updated_at ?? new Date().toISOString();

  const payload: ProductVariant = {
    action,
    productId: variant.id.toString(),
    updatedDate,
    name,
    imageUrl,
    url,
    isInStock,
    price: parseFloat(variant.price ?? "0"),
    currency: shopCurrency,
    categories,
    itemGroupId: product.id.toString(),
  };

  const tags = mapWebhookOptions(product.options, variant);
  if (Object.keys(tags).length > 0) {
    payload.tags = tags;
  }

  if (product.vendor) {
    payload.brand = product.vendor;
  }

  if (product.body_html) {
    payload.description = stripHtml(product.body_html).substring(0, 10000);
  }

  const compareAtPrice = parseFloat(variant.compare_at_price ?? "0");
  const price = parseFloat(variant.price ?? "0");
  if (compareAtPrice > price) {
    payload.oldPrice = compareAtPrice;
  }

  return payload;
};
