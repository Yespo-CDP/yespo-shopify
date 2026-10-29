/**
 * Yespo `update` changes a product that was already accepted.
 * A missing row, or a row left after a rejected create, must be sent as `create`.
 */
export function yespoProductAction(
  existing: { syncFailed: boolean } | null | undefined,
): "create" | "update" {
  if (!existing || existing.syncFailed) {
    return "create";
  }
  return "update";
}
