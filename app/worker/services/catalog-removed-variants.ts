/**
 * Variant ids staged for one country during a successful market bulk.
 * A row counts even when it has no price: the variant is still in the catalog,
 * so it must not be marked out of stock.
 * Pass `present` to add the rows of another page to the same map.
 */
export function variantIdsPresentInCountry(
  rows: Array<{ variantId?: string | null; countryCode?: string | null }>,
  present: Map<string, Set<string>> = new Map(),
): Map<string, Set<string>> {
  for (const row of rows) {
    if (!row.countryCode || !row.variantId) {
      continue;
    }

    const ids = present.get(row.countryCode) ?? new Set<string>();
    ids.add(row.variantId);
    present.set(row.countryCode, ids);
  }

  return present;
}

/**
 * Previously synced rows whose variant did not appear in this country's catalog.
 */
export function marketSyncRowsRemovedFromCatalog<T extends { variantId: string }>(
  rows: T[],
  presentVariantIds: ReadonlySet<string>,
): T[] {
  return rows.filter((row) => !presentVariantIds.has(row.variantId));
}
