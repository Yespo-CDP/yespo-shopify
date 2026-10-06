import type { ProductVariantSyncLogView } from "~/@types/productVariantSyncLog";
import {
  productVariantSyncLogRepository,
  productVariantSyncRepository,
} from "~/repositories/repositories.server";

/**
 * Loads the product sync log and the count of Shopify products that have
 * at least one successfully synced variant.
 */
export async function getProductVariantSyncLogView(
  shopUrl: string,
): Promise<ProductVariantSyncLogView | null> {
  const productVariantSyncLog =
    await productVariantSyncLogRepository.getProductVariantSyncLogByShop(
      shopUrl,
    );
  if (!productVariantSyncLog) return null;

  const syncedProductCount =
    await productVariantSyncRepository.countSyncedProductsByShop(
      productVariantSyncLog.shopId,
    );

  return { ...productVariantSyncLog, syncedProductCount };
}
