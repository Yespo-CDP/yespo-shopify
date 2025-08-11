import type {
  CustomerSyncLog,
  CustomerSyncLogCreate,
} from "~/@types/customerSyncLog";

/**
 * Interface for managing customer sync log records in the data store.
 *
 * Provides methods to retrieve, create and update customer sync log records by shop id.
 *
 * @interface CustomerSyncLogRepository
 */
export default interface CustomerSyncLogRepository {
  /**
   * Retrieves customer sync log record by shopUrl.
   *
   * @param {string} shopUrl - The unique URL identifier of the shop to update.
   * @returns {Promise<CustomerSyncLog | null>} A promise that resolves to the customer syncs log records if found, or null otherwise.
   */
  getCustomerSyncLogByShop(shopUrl: string): Promise<CustomerSyncLog | null>;

  /**
   * Creates or update a new customer sync log record.
   *
   * @param {CustomerSyncCreate} data - The data to be stored.
   * @returns {Promise<CustomerSyncLog>} A promise that resolves to the created or updated customer sync log record.
   */
  createOrUpdateCustomerSyncLog(
    data: CustomerSyncLogCreate,
  ): Promise<CustomerSyncLog>;
}
