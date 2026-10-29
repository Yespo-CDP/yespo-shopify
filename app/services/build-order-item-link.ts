/**
 * Product link and image for a Yespo order item, using the same sources as
 * product sync: variant image, then the product featured image; storefront URL
 * without a variant query.
 */
export function buildOrderItemLink({
  shopDomain,
  handle,
  onlineStoreUrl,
  variantImageUrl,
  featuredImageUrl,
}: {
  shopDomain: string;
  handle?: string | null;
  onlineStoreUrl?: string | null;
  variantImageUrl?: string | null;
  featuredImageUrl?: string | null;
}): { url: string; imageUrl: string } {
  const imageUrl = variantImageUrl ?? featuredImageUrl ?? "";
  const url =
    onlineStoreUrl ??
    (shopDomain && handle
      ? `https://${shopDomain}/products/${handle}`
      : "");

  return { url, imageUrl };
}
