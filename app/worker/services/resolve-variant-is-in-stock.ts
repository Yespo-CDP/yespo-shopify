/**
 * Inventory is treated as available when Shopify does not track quantity
 * (`null`) or the tracked quantity is above zero.
 */
export function isInventoryInStock(
  inventoryQuantity: number | null | undefined,
): boolean {
  return inventoryQuantity == null || inventoryQuantity > 0;
}

/**
 * One market and many markets share one rule: the product is published when
 * `publishedInContext` is true for at least one enabled market country.
 */
export function isPublishedInAnyMarket(
  publishedInCountry: Record<string, boolean> | undefined,
): boolean {
  return Object.values(publishedInCountry ?? {}).some(Boolean);
}

/**
 * Base Yespo `isInStock`: in stock on the shelf and published in a market.
 * Stock without a market publication is `0`.
 */
export function resolveVariantIsInStock(
  inventoryQuantity: number | null | undefined,
  publishedInAnyMarket: boolean,
): 0 | 1 {
  return isInventoryInStock(inventoryQuantity) && publishedInAnyMarket ? 1 : 0;
}
