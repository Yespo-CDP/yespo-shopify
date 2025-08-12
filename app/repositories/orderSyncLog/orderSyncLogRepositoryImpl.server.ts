import type IOrderSyncLogRepository from "./orderSyncLogRepository.server";
import type { PrismaClient } from "@prisma/client";
import type { OrderSyncLog, OrderSyncLogCreate } from "~/@types/orderSyncLog";

/**
 * Implementation of the IOrderSyncLogRepository interface using Prisma for data persistence.
 *
 * This class manages operations related to orders synchronizations logs, including fetching by shopUrl,
 * creating and updating of entries.
 *
 * @class OrderSyncLogRepositoryImpl
 * @implements {IOrderSyncLogRepository}
 */
export default class OrderSyncLogRepositoryImpl
  implements IOrderSyncLogRepository
{
  /**
   * Creates an instance of OrderSyncLogRepositoryImpl.
   *
   * @param {PrismaClient} database - The Prisma client instance used to access the database.
   */
  constructor(readonly database: PrismaClient) {}

  /**
   * Retrieves order sync log record by shopUrl.
   *
   * @param {string} shopUrl - The unique URL identifier of the shop to update.
   * @returns {Promise<OrderSyncLog | null>} A promise that resolves to the order syncs log records if found, or null otherwise.
   */
  async getOrderSyncLogByShop(shopUrl: string): Promise<OrderSyncLog | null> {
    return this.database.orderSyncLog.findFirst({
      where: {
        shop: { shopUrl },
      },
    });
  }

  /**
   * Creates or updates an order sync log record using the provided input.
   *
   * If a record with the given `data.shop.connect.id` exists, it is updated. Otherwise, a new record is created.
   *
   * @param {OrderSyncLogCreate} data - The data to be stored.
   * @returns {Promise<OrderSync>} A promise that resolves to the created or updated order sync log record.
   */
  async createOrUpdateOrderSyncLog(
    data: OrderSyncLogCreate,
  ): Promise<OrderSyncLog> {
    return this.database.orderSyncLog.upsert({
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
