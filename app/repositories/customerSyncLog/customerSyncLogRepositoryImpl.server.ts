import type ICustomerSyncLogRepository from "./customerSyncLogRepository.server";
import type { PrismaClient } from "@prisma/client";
import type {
  CustomerSyncLog,
  CustomerSyncLogCreate,
} from "~/@types/customerSyncLog";

/**
 * Implementation of the ICustomerSyncLogRepository interface using Prisma for data persistence.
 *
 * This class manages operations related to customers synchronizations logs, including fetching by shopUrl,
 * creating and updating of entries.
 *
 * @class CustomerSyncLogRepositoryImpl
 * @implements {ICustomerSyncLogRepository}
 */
export default class CustomerSyncLogRepositoryImpl
  implements ICustomerSyncLogRepository
{
  /**
   * Creates an instance of CustomerSyncLogRepositoryImpl.
   *
   * @param {PrismaClient} database - The Prisma client instance used to access the database.
   */
  constructor(readonly database: PrismaClient) {}

  /**
   * Retrieves customer sync log record by shopUrl.
   *
   * @param {string} shopUrl - The unique URL identifier of the shop to update.
   * @returns {Promise<CustomerSyncLog | null>} A promise that resolves to the customer syncs log records if found, or null otherwise.
   */
  async getCustomerSyncLogByShop(
    shopUrl: string,
  ): Promise<CustomerSyncLog | null> {
    return this.database.customerSyncLog.findFirst({
      where: {
        shop: { shopUrl },
      },
    });
  }

  /**
   * Creates or updates an customer sync log record using the provided input.
   *
   * If a record with the given `data.shop.connect.id` exists, it is updated. Otherwise, a new record is created.
   *
   * @param {CustomerSyncLogCreate} data - The data to be stored.
   * @returns {Promise<CustomerSync>} A promise that resolves to the created or updated customer sync log record.
   */
  async createOrUpdateCustomerSyncLog(
    data: CustomerSyncLogCreate,
  ): Promise<CustomerSyncLog> {
    return this.database.customerSyncLog.upsert({
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
