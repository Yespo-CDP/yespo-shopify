import type IProductVariantSyncRepository from "./productVariantSyncRepository.server";
import type { PrismaClient } from "@prisma/client";
import type {
  ProductVariantSync,
  ProductVariantSyncCreate,
  ProductVariantSyncUpdate,
} from "~/@types/productVariantSync";

/**
 * Implementation of the IProductVariantSyncRepository interface using Prisma for data persistence.
 *
 * This class manages operations related to product variant synchronizations, including fetching by variant ids,
 * creating, updating, and upserting of entries.
 *
 * @class ProductVariantSyncRepositoryImpl
 * @implements {IProductVariantSyncRepository}
 */
export default class ProductVariantSyncRepositoryImpl
  implements IProductVariantSyncRepository
{
  /**
   * Creates an instance of ProductVariantSyncRepositoryImpl.
   *
   * @param {PrismaClient} database - The Prisma client instance used to access the database.
   */
  constructor(readonly database: PrismaClient) {}

  /**
   * Retrieves product variant sync records by the provided variant ids.
   *
   * @param {string[]} variantIds - Shopify variant IDs array (e.g. gid://shopify/ProductVariant/123).
   * @returns {Promise<ProductVariantSync[]>} A promise resolving to the product variant sync records.
   */
  async getProductVariantSyncByVariantIds(
    variantIds: string[],
  ): Promise<ProductVariantSync[]> {
    return this.database.productVariantSync.findMany({
      where: {
        variantId: { in: variantIds },
      },
    });
  }

  /**
   * Creates product variant sync record using the provided input.
   *
   * @param {ProductVariantSyncCreate} data - The product variant sync data to create.
   * @returns {Promise<ProductVariantSync>} A promise resolving to the created product variant sync record.
   */
  async createProductVariantSync(
    data: ProductVariantSyncCreate,
  ): Promise<ProductVariantSync> {
    return this.database.productVariantSync.create({
      data,
    });
  }

  /**
   * Creates or updates a product variant sync record using the provided input.
   *
   * If a record with the given `variantId` exists, it is updated. Otherwise, a new record is created.
   *
   * @param {ProductVariantSyncCreate} data - The data to be stored.
   * @returns {Promise<ProductVariantSync>} A promise that resolves to the created or updated product variant sync record.
   */
  async createOrUpdateProductVariantSync(
    data: ProductVariantSyncCreate,
  ): Promise<ProductVariantSync> {
    const productVariantSync = await this.database.productVariantSync.findFirst({
      where: {
        variantId: data?.variantId,
      },
    });

    return this.database.productVariantSync.upsert({
      where: {
        id: productVariantSync?.id ?? -1,
      },
      create: {
        ...data,
      },
      update: {
        ...data,
      },
    });
  }

  /**
   * Updates a product variant sync record using the provided input.
   *
   * If a record with the given `variantId` exists, it is updated.
   *
   * @param {string} variantId - Shopify variant ID to update the product variant sync record.
   * @param {ProductVariantSyncUpdate} data - The product variant sync data to update.
   * @returns {Promise<ProductVariantSync>} A promise resolving to the updated product variant sync record.
   */
  async updateProductVariantSync(
    variantId: string,
    data: ProductVariantSyncUpdate,
  ): Promise<ProductVariantSync> {
    const productVariantSync = await this.database.productVariantSync.findFirst({
      where: {
        variantId,
      },
    });

    return this.database.productVariantSync.update({
      where: {
        id: productVariantSync?.id,
      },
      data,
    });
  }

  async getVariantIdsByShop(shopId: number): Promise<string[]> {
    const records = await this.database.productVariantSync.findMany({
      where: { shopId },
      select: { variantId: true },
    });
    return records.map((r) => r.variantId);
  }

  async deleteByVariantIds(shopId: number, variantIds: string[]): Promise<void> {
    if (variantIds.length === 0) return;
    await this.database.productVariantSync.deleteMany({
      where: {
        shopId,
        variantId: { in: variantIds },
      },
    });
  }
}
