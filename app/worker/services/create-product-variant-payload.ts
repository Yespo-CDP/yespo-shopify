import type { ProductData, ProductVariantData } from "~/@types/product";
import type { ProductVariant } from "~/@types/productVariant";

/**
 * Converts Shopify product and variant data into a Yespo product variant payload.
 */
export const createProductVariantPayload = (
  product: ProductData,
  variant: ProductVariantData,
  shopCurrency = "",
): ProductVariant => {
  const variantTitle =
    variant.title === "Default Title" ? "" : variant.title.trim();
  const name = variantTitle
    ? `${product.title} - ${variantTitle}`
    : product.title;

  return {
    externalVariantId: variant.id.split("/").pop() ?? "",
    externalProductId: product.id.split("/").pop() ?? "",
    name,
    description: product.description ?? "",
    price: parseFloat(variant.price ?? "0"),
    currency:
      variant.contextualPricing?.price?.currencyCode ?? shopCurrency,
  };
};
