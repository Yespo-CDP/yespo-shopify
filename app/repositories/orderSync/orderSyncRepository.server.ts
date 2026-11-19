import type {
  OrderSync,
  OrderSyncCreate,
  OrderSyncUpdate,
} from "~/@types/orderSync";

/**
 * Interface for managing order sync records in the data store.
 *
 * Provides methods to retrieve, create and update order sync records by ids.
 *
 * @interface OrderSyncRepository
 */
export default interface OrderSyncRepository {
  /**
   * Retrieves synced orders by shopify order ids.
   *
   * @param {number} shopId - Shop.id of the shop the records belong to.
   * @param {string[]} orderIds - Shopify order IDs array (e.g. gid://shopify/Order/123).
   * @returns {Promise<OrderSync[]>} A promise that resolves to the order syncs records.
   */
  getOrderSyncByOrderIds(
    shopId: number,
    orderIds: string[],
  ): Promise<OrderSync[]>;

  /**
   * Creates a new order sync record.
   *
   * @param {OrderSyncCreate} data - The data to be stored.
   * @returns {Promise<OrderSync>} A promise that resolves to the created order sync record.
   */
  createOrderSync(data: OrderSyncCreate): Promise<OrderSync>;

  /**
   * Creates a new order sync record.
   *
   * @param {OrderSyncCreate} data - The data to be stored.
   * @returns {Promise<OrderSync>} A promise that resolves to the created or updated order sync record.
   */
  createOrUpdateOrderSync(data: OrderSyncCreate): Promise<OrderSync>;

  /**
   * Updates an existing order sync record identified by order ID.
   *
   * @param {String} orderId: Shopify order ID to the update order sync record.
   * @param {OrderSyncUpdate} data - The data to be update order sync record.
   * @returns {Promise<OrderSync>} A promise that resolves to the updated order sync record.
   */
  updateOrderSync(orderId: string, data: OrderSyncUpdate): Promise<OrderSync>;

  /**
   * Deletes the order sync record of an order, if there is one.
   *
   * @param {number} shopId - Shop.id of the shop the record belongs to.
   * @param {string} orderId - Shopify order ID (e.g. gid://shopify/Order/123).
   * @returns {Promise<number>} A promise that resolves to the number of deleted records.
   */
  deleteOrderSync(shopId: number, orderId: string): Promise<number>;
}
