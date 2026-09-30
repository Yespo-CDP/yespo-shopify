import { appendVariantParam } from "~/worker/services/append-variant-param";

/**
 * Product link and image for a Yespo order item, using the same sources as
 * product sync: variant image, then the product featured image; storefront URL
 * with `?variant=<id>`.
 */
export function buildOrderItemLink({
  variantId,
  shopDomain,
  handle,
  onlineStoreUrl,
  variantImageUrl,
  featuredImageUrl,
}: {
  variantId: string;
  shopDomain: string;
  handle?: string | null;
  onlineStoreUrl?: string | null;
  variantImageUrl?: string | null;
  featuredImageUrl?: string | null;
}): { url: string; imageUrl: string } {
  const imageUrl = variantImageUrl ?? featuredImageUrl ?? "";
  const baseUrl =
    onlineStoreUrl ??
    (shopDomain && handle
      ? `https://${shopDomain}/products/${handle}`
      : "");

  return {
    url: appendVariantParam(baseUrl, variantId),
    imageUrl,
  };
}
