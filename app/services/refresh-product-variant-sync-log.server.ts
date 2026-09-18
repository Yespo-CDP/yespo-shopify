import type { ProductVariantsResponse } from "~/@types/productVariant";
import {
  productVariantSyncLogRepository,
  productVariantSyncRepository,
} from "~/repositories/repositories.server";

export function collectRejectedProductIds(
  failedVariants: ProductVariantsResponse["failedVariants"],
): Set<string> {
  if (!failedVariants) return new Set();
  const items = Array.isArray(failedVariants)
    ? failedVariants
    : [failedVariants];
  return new Set(
    items
      .map((item) =>
        item && typeof item === "object" && "productId" in item
          ? String((item as { productId?: unknown }).productId ?? "")
          : "",
      )
      .filter(Boolean),
  );
}

export function variantGidFromNumericId(productId: string): string {
  return productId.startsWith("gid://")
    ? productId
    : `gid://shopify/ProductVariant/${productId}`;
}

/**
 * Marks a sent batch as accepted or rejected in ProductVariantSync.
 */
export async function markProductVariantSyncResults(
  shopId: number,
  sentNumericIds: string[],
  failedVariants: ProductVariantsResponse["failedVariants"],
): Promise<void> {
  const rejected = collectRejectedProductIds(failedVariants);
  const failedGids = sentNumericIds
    .filter((id) => rejected.has(id))
    .map(variantGidFromNumericId);
  const acceptedGids = sentNumericIds
    .filter((id) => !rejected.has(id))
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
