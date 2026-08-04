import type IProductVariantSyncLogRepository from "./productVariantSyncLogRepository.server";
import type { PrismaClient } from "@prisma/client";
import type {
  ProductVariantSyncLog,
  ProductVariantSyncLogCreate,
} from "~/@types/productVariantSyncLog";

/**
 * Implementation of the IProductVariantSyncLogRepository interface using Prisma for data persistence.
 *
 * This class manages operations related to product variant synchronization logs, including fetching by shopUrl,
 * creating and updating of entries.
 *
 * @class ProductVariantSyncLogRepositoryImpl
 * @implements {IProductVariantSyncLogRepository}
 */
export default class ProductVariantSyncLogRepositoryImpl
  implements IProductVariantSyncLogRepository
{
  /**
   * Creates an instance of ProductVariantSyncLogRepositoryImpl.
   *
   * @param {PrismaClient} database - The Prisma client instance used to access the database.
   */
  constructor(readonly database: PrismaClient) {}

  /**
   * Retrieves product variant sync log record by shopUrl.
   *
   * @param {string} shopUrl - The unique URL identifier of the shop to update.
   * @returns {Promise<ProductVariantSyncLog | null>} A promise that resolves to the product variant sync log record if found, or null otherwise.
   */
  async getProductVariantSyncLogByShop(
    shopUrl: string,
  ): Promise<ProductVariantSyncLog | null> {
    return this.database.productVariantSyncLog.findFirst({
      where: {
        shop: { shopUrl },
      },
    });
  }

  /**
   * Creates or updates a product variant sync log record using the provided input.
   *
   * If a record with the given `data.shop.connect.id` exists, it is updated. Otherwise, a new record is created.
   *
   * @param {ProductVariantSyncLogCreate} data - The data to be stored.
   * @returns {Promise<ProductVariantSyncLog>} A promise that resolves to the created or updated product variant sync log record.
   */
  async createOrUpdateProductVariantSyncLog(
    data: ProductVariantSyncLogCreate,
  ): Promise<ProductVariantSyncLog> {
    return this.database.productVariantSyncLog.upsert({
      where: {
        shopId: data.shop?.connect?.id,
      },
      create: {
        ...data,
      },
      update: {
        ...data,
      },
    });
  }
}
