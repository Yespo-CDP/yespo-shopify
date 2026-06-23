import type {
  ProductVariantSync,
  ProductVariantSyncCreate,
  ProductVariantSyncUpdate,
} from "~/@types/productVariantSync";

/**
 * Interface for managing product variant sync records in the data store.
 *
 * Provides methods to retrieve, create and update product variant sync records by ids.
 *
 * @interface ProductVariantSyncRepository
 */
export default interface ProductVariantSyncRepository {
  /**
   * Retrieves synced product variants by Shopify variant ids.
   *
   * @param {string[]} variantIds - Shopify variant IDs array (e.g. gid://shopify/ProductVariant/123).
   * @returns {Promise<ProductVariantSync[]>} A promise that resolves to the product variant sync records.
   */
  getProductVariantSyncByVariantIds(
    variantIds: string[],
  ): Promise<ProductVariantSync[]>;

  /**
   * Creates a new product variant sync record.
   *
   * @param {ProductVariantSyncCreate} data - The data to be stored.
   * @returns {Promise<ProductVariantSync>} A promise that resolves to the created product variant sync record.
   */
  createProductVariantSync(
    data: ProductVariantSyncCreate,
  ): Promise<ProductVariantSync>;

  /**
   * Creates or updates a product variant sync record.
   *
   * @param {ProductVariantSyncCreate} data - The data to be stored.
   * @returns {Promise<ProductVariantSync>} A promise that resolves to the created or updated product variant sync record.
   */
  createOrUpdateProductVariantSync(
    data: ProductVariantSyncCreate,
  ): Promise<ProductVariantSync>;

  /**
   * Updates an existing product variant sync record identified by variant ID.
   *
   * @param {string} variantId - Shopify variant ID to update the product variant sync record.
   * @param {ProductVariantSyncUpdate} data - The data to update the product variant sync record.
   * @returns {Promise<ProductVariantSync>} A promise that resolves to the updated product variant sync record.
   */
  updateProductVariantSync(
    variantId: string,
    data: ProductVariantSyncUpdate,
  ): Promise<ProductVariantSync>;

  /**
   * Returns all variant IDs currently tracked for a given shop.
   * Used to detect variants that have been deleted from Shopify.
   */
  getVariantIdsByShop(shopId: number): Promise<string[]>;

  /**
   * Returns all variant IDs tracked for a specific Shopify product GID.
   * Used when a PRODUCTS_DELETE webhook arrives (no variants in payload).
   */
  getVariantIdsByProductId(shopId: number, productId: string): Promise<string[]>;

  /**
   * Removes product variant sync records for the given variant IDs.
   */
  deleteByVariantIds(shopId: number, variantIds: string[]): Promise<void>;

  /**
   * Removes all product variant sync records for a given Shopify product GID.
   */
  deleteByProductId(shopId: number, productId: string): Promise<void>;
}
