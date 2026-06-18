import type {
  ProductVariantSyncLog,
  ProductVariantSyncLogCreate,
} from "~/@types/productVariantSyncLog";

/**
 * Interface for managing product variant sync log records in the data store.
 *
 * Provides methods to retrieve, create and update product variant sync log records by shop id.
 *
 * @interface ProductVariantSyncLogRepository
 */
export default interface ProductVariantSyncLogRepository {
  /**
   * Retrieves product variant sync log record by shopUrl.
   *
   * @param {string} shopUrl - The unique URL identifier of the shop to update.
   * @returns {Promise<ProductVariantSyncLog | null>} A promise that resolves to the product variant sync log record if found, or null otherwise.
   */
  getProductVariantSyncLogByShop(
    shopUrl: string,
  ): Promise<ProductVariantSyncLog | null>;

  /**
   * Creates or updates a product variant sync log record.
   *
   * @param {ProductVariantSyncLogCreate} data - The data to be stored.
   * @returns {Promise<ProductVariantSyncLog>} A promise that resolves to the created or updated product variant sync log record.
   */
  createOrUpdateProductVariantSyncLog(
    data: ProductVariantSyncLogCreate,
  ): Promise<ProductVariantSyncLog>;
}
