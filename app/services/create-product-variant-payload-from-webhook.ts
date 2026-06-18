import type { ProductVariant } from "~/@types/productVariant";

export interface ProductVariantWebhookPayload {
  id: number;
  title: string;
  price: string;
  created_at?: string;
  updated_at?: string;
  admin_graphql_api_id: string;
}

export interface ProductWebhookPayload {
  id: number;
  title: string;
  body_html?: string;
  created_at: string;
  updated_at: string;
  admin_graphql_api_id: string;
  variants?: ProductVariantWebhookPayload[];
}

/**
 * Converts a Shopify product webhook payload into Yespo product variant payloads.
 */
export const createProductVariantPayloadFromWebhook = (
  product: ProductWebhookPayload,
  variant: ProductVariantWebhookPayload,
  shopCurrency = "",
): ProductVariant => {
  const variantTitle =
    variant.title === "Default Title" ? "" : variant.title.trim();
  const name = variantTitle
    ? `${product.title} - ${variantTitle}`
    : product.title;

  return {
    externalVariantId: variant.id.toString(),
    externalProductId: product.id.toString(),
    name,
    description: product.body_html ?? "",
    price: parseFloat(variant.price ?? "0"),
    currency: shopCurrency,
  };
};
