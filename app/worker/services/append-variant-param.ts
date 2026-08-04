/**
 * Appends a `variant=<id>` query parameter to a Shopify product URL so the link
 * resolves to the exact variant (Yespo `productId` === the numeric variant id).
 *
 * Returns the URL unchanged when either argument is empty, and uses `&` when the
 * URL already carries a query string.
 */
export function appendVariantParam(url: string, variantId?: string): string {
  if (!url || !variantId) {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}variant=${variantId}`;
}
