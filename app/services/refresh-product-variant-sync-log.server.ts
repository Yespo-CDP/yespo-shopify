import type { ProductVariantsResponse } from "~/@types/productVariant";
import {
  productVariantSyncLogRepository,
  productVariantSyncRepository,
} from "~/repositories/repositories.server";
import { productIdsYespoAccepted } from "~/services/product-sync-result";

export function variantGidFromNumericId(productId: string): string {
  return productId.startsWith("gid://")
    ? productId
    : `gid://shopify/ProductVariant/${productId}`;
}

/**
 * Marks a sent batch in ProductVariantSync.
 * `syncFailed` becomes false only for variants Yespo explicitly accepted.
 * Rejected variants, and variants missing from `items`, stay failed.
 */
export async function markProductVariantSyncResults(
  shopId: number,
  sentNumericIds: string[],
  result?: Pick<ProductVariantsResponse, "items" | "summary">,
): Promise<void> {
  const accepted = productIdsYespoAccepted(
    sentNumericIds,
    result?.items,
    result?.summary,
  );
  const acceptedGids = sentNumericIds
    .filter((id) => accepted.has(id))
    .map(variantGidFromNumericId);
  const failedGids = sentNumericIds
    .filter((id) => !accepted.has(id))
    .map(variantGidFromNumericId);

  await Promise.all([
    productVariantSyncRepository.setSyncFailed(shopId, acceptedGids, false),
    productVariantSyncRepository.setSyncFailed(shopId, failedGids, true),
  ]);
}

/**
 * Rebuilds Data Sync counters from ProductVariantSync rows.
 * Skips while a historical bulk run is IN_PROGRESS so the worker log stays authoritative.
 */
export async function refreshProductVariantSyncLog(
  shopId: number,
): Promise<void> {
  const log =
    await productVariantSyncLogRepository.getProductVariantSyncLogByShopId(
      shopId,
    );
  if (!log || log.status === "IN_PROGRESS") {
    return;
  }

  const [totalCount, failedCount] = await Promise.all([
    productVariantSyncRepository.countByShop(shopId),
    productVariantSyncRepository.countFailedByShop(shopId),
  ]);

  await productVariantSyncLogRepository.createOrUpdateProductVariantSyncLog({
    status: "COMPLETE",
    skippedCount: 0,
    failedCount,
    syncedCount: Math.max(0, totalCount - failedCount),
    totalCount,
    shop: {
      connect: {
        id: shopId,
      },
    },
  });
}
