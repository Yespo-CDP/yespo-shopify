import { normalizeYespoItems } from "~/utils/normalize-yespo-items";

export interface YespoBatchSummary {
  received?: number;
  accepted?: number;
  rejected?: number;
}

/**
 * Sent variant ids that Yespo explicitly accepted.
 * A rejected item, or an item that omits `productId`, does not clear a failure.
 */
export function productIdsYespoAccepted(
  sentProductIds: string[],
  items: unknown,
  summary?: YespoBatchSummary | null,
): Set<string> {
  const list = normalizeYespoItems(
    items as object | object[] | null | undefined,
  );
  const accepted = new Set<string>();

  if (list.length === 0) {
    if (
      summary &&
      summary.rejected === 0 &&
      summary.accepted === sentProductIds.length &&
      sentProductIds.length > 0
    ) {
      for (const id of sentProductIds) accepted.add(id);
    }
    return accepted;
  }

  const acceptedReturned = new Set<string>();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const record = item as { productId?: unknown; status?: unknown };
    if (record.status !== "accepted" || record.productId == null) continue;
    acceptedReturned.add(numericProductId(String(record.productId)));
  }

  for (const id of sentProductIds) {
    if (acceptedReturned.has(numericProductId(id))) accepted.add(id);
  }
  return accepted;
}

function numericProductId(productId: string): string {
  const trimmed = productId.trim();
  const numeric = trimmed.split("/").pop();
  return numeric || trimmed;
}
