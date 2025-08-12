import type {
  CustomerSync,
  CustomerSyncCreate,
  CustomerSyncUpdate,
} from "~/@types/customerSync";

/**
 * Interface for managing customer sync records in the data store.
 *
 * Provides methods to retrieve, create and update customer sync records by ids.
 *
 * @interface CustomerSyncRepository
 */
export default interface CustomerSyncRepository {
  /**
   * Retrieves synced customers by shopify customer ids.
   *
   * @param {string[]} customerIds - Shopify customer IDs array (e.g. gid://shopify/Customer/123).
   * @returns {Promise<CustomerSync[]>} A promise that resolves to the customer syncs records.
   */
  getCustomerSyncByCustomerIds(customerIds: string[]): Promise<CustomerSync[]>;

  /**
   * Creates a new customer sync record.
   *
   * @param {CustomerSyncCreate} data - The data to be stored.
   * @returns {Promise<CustomerSync>} A promise that resolves to the created customer sync record.
   */
  createCustomerSync(data: CustomerSyncCreate): Promise<CustomerSync>;

  /**
   * Creates a new customer sync record.
   *
   * @param {CustomerSyncCreate} data - The data to be stored.
   * @returns {Promise<CustomerSync>} A promise that resolves to the created or updated customer sync record.
   */
  createOrUpdateCustomerSync(data: CustomerSyncCreate): Promise<CustomerSync>;

  /**
   * Updates an existing customer sync record identified by customer ID.
   *
   * @param {String} customerId: Shopify customer ID to the update customer sync record.
   * @param {CustomerSyncUpdate} data - The data to be update customer sync record.
   * @returns {Promise<CustomerSync>} A promise that resolves to the updated customer sync record.
   */
  updateCustomerSync(
    customerId: string,
    data: CustomerSyncUpdate,
  ): Promise<CustomerSync>;
}
