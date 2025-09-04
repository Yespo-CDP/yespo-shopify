import type { OrderSyncLog, OrderSyncLogCreate } from "~/@types/orderSyncLog";

/**
 * Interface for managing order sync log records in the data store.
 *
 * Provides methods to retrieve, create and update order sync log records by shop id.
 *
 * @interface OrderSyncLogRepository
 */
export default interface OrderSyncLogRepository {
  /**
   * Retrieves order sync log record by shopUrl.
   *
   * @param {string} shopUrl - The unique URL identifier of the shop to update.
   * @returns {Promise<OrderSyncLog | null>} A promise that resolves to the order syncs log records if found, or null otherwise.
   */
  getOrderSyncLogByShop(shopUrl: string): Promise<OrderSyncLog | null>;

  /**
   * Creates or update a new order sync log record.
   *
   * @param {OrderSyncLogCreate} data - The data to be stored.
   * @returns {Promise<OrderSyncLog>} A promise that resolves to the created or updated order sync log record.
   */
  createOrUpdateOrderSyncLog(data: OrderSyncLogCreate): Promise<OrderSyncLog>;
}
