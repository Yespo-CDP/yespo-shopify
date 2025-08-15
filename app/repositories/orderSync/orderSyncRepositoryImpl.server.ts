import type IOrderSyncRepository from "./orderSyncRepository.server";
import type { PrismaClient } from "@prisma/client";
import type {
  OrderSync,
  OrderSyncCreate,
  OrderSyncUpdate,
} from "~/@types/orderSync";

/**
 * Implementation of the IOrderSyncRepository interface using Prisma for data persistence.
 *
 * This class manages operations related to orders synchronizations, including fetching by order ids,
 * creating, updating, and upserting of entries.
 *
 * @class OrderSyncRepositoryImpl
 * @implements {IOrderSyncRepository}
 */
export default class OrderSyncRepositoryImpl implements IOrderSyncRepository {
  /**
   * Creates an instance of OrderSyncRepositoryImpl.
   *
   * @param {PrismaClient} database - The Prisma client instance used to access the database.
   */
  constructor(readonly database: PrismaClient) {}

  /**
   * Retrieves order sync records by the provided order Ids.
   *
   * @param {string[]} orderIds - Shopify order IDs array (e.g. gid://shopify/Order/123).
   * @returns {Promise<OrderSync[]>} A promise resolving to the order sync records.
   */
  async getOrderSyncByOrderIds(orderIds: string[]): Promise<OrderSync[]> {
    return this.database.orderSync.findMany({
      where: {
        orderId: { in: orderIds },
      },
    });
  }

  /**
   * Creates order sync record using the provided input.
   *
   * @param {OrderSyncCreate} data - The order sync data to create.
   * @returns {Promise<OrderSync>} A promise resolving to the created order sync record.
   */
  async createOrderSync(data: OrderSyncCreate): Promise<OrderSync> {
    return this.database.orderSync.create({
      data,
    });
  }

  /**
   * Creates or updates an order sync record using the provided input.
   *
   * If a record with the given `orderId` exists, it is updated. Otherwise, a new record is created.
   *
   * @param {OrderSyncCreate} data - The data to be stored.
   * @returns {Promise<OrderSync>} A promise that resolves to the created or updated order sync record.
   */
  async createOrUpdateOrderSync(data: OrderSyncCreate): Promise<OrderSync> {
    const orderSync = await this.database.orderSync.findFirst({
      where: {
        orderId: data?.orderId,
      },
    });

    return this.database.orderSync.upsert({
      where: {
        id: orderSync?.id ?? -1,
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
   * Updates an order sync record using the provided input.
   *
   * If a record with the given `orderId` exists, it is updated.
   *
   * @param {String} orderId: Shopify order ID to the update order sync record.
   * @param {OrderSyncUpdate} data - The order sync data to update.
   * @returns {Promise<OrderSync>} A promise resolving to the updated order sync record.
   */
  async updateOrderSync(
    orderId: string,
    data: OrderSyncUpdate,
  ): Promise<OrderSync> {
    const orderSync = await this.database.orderSync.findFirst({
      where: {
        orderId,
      },
    });

    return this.database.orderSync.update({
      where: {
        id: orderSync?.id,
      },
      data,
    });
  }
}
