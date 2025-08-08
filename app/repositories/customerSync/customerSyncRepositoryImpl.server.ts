import type ICustomerSyncRepository from "./customerSyncRepository.server";
import type { PrismaClient } from "@prisma/client";
import type {
  CustomerSync,
  CustomerSyncCreate,
  CustomerSyncUpdate,
} from "~/@types/customerSync";

/**
 * Implementation of the ICustomerSyncRepository interface using Prisma for data persistence.
 *
 * This class manages operations related to customers synchronizations , including fetching by customer ids,
 * creating, updating, and upserting of entries.
 *
 * @class CustomerSyncRepositoryImpl
 * @implements {ICustomerSyncRepository}
 */
export default class CustomerSyncRepositoryImpl
  implements ICustomerSyncRepository
{
  /**
   * Creates an instance of CustomerSyncRepositoryImpl.
   *
   * @param {PrismaClient} database - The Prisma client instance used to access the database.
   */
  constructor(readonly database: PrismaClient) {}

  /**
   * Retrieves customer sync records by the provided customer Ids.
   *
   * @param {string[]} customerIds - Shopify customer IDs array (e.g. gid://shopify/Customer/123).
   * @returns {Promise<CustomerSync[]>} A promise resolving to the customer sync records.
   */
  async getCustomerSyncByCustomerIds(
    customerIds: string[],
  ): Promise<CustomerSync[]> {
    return this.database.customerSync.findMany({
      where: {
        customerId: { in: customerIds },
      },
    });
  }

  /**
   * Creates customer sync record using the provided input.
   *
   * @param {CustomerSyncCreate} data - The customer sync data to create.
   * @returns {Promise<CustomerSync>} A promise resolving to the created customer sync record.
   */
  async createCustomerSync(data: CustomerSyncCreate): Promise<CustomerSync> {
    return this.database.customerSync.create({
      data,
    });
  }

  /**
   * Creates or updates an customer sync record using the provided input.
   *
   * If a record with the given `customerId` exists, it is updated. Otherwise, a new record is created.
   *
   * @param {number} shopId - Shop id in our database.
   * @param {CustomerSyncCreate} data - The data to be stored.
   * @returns {Promise<CustomerSync>} A promise that resolves to the created or updated customer sync record.
   */
  async createOrUpdateCustomerSync(
    data: CustomerSyncCreate,
  ): Promise<CustomerSync> {
    const customerSync = await this.database.customerSync.findFirst({
      where: {
        customerId: data?.customerId,
      },
    });

    return this.database.customerSync.upsert({
      where: {
        id: customerSync?.id ?? -1,
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
   * Updates an customer sync record using the provided input.
   *
   * If a record with the given `customerId` exists, it is updated.
   *
   * @param {String} customerId: Shopify customer ID to the update customer sync record.
   * @param {CustomerSyncUpdate} data - The customer sync data to update.
   * @returns {Promise<CustomerSync>} A promise resolving to the updated customer sync record.
   */
  async updateCustomerSync(
    customerId: string,
    data: CustomerSyncUpdate,
  ): Promise<CustomerSync> {
    const customerSync = await this.database.customerSync.findFirst({
      where: {
        customerId,
      },
    });

    return this.database.customerSync.update({
      where: {
        id: customerSync?.id,
      },
      data,
    });
  }
}
