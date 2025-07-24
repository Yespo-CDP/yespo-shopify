import type { Customer, CustomerCreate } from "~/@types/customer";

/**
 * Interface representing a repository for managing customer records.
 *
 * Provides a method to create or update (upsert) customer data in the storage layer.
 *
 * @interface CustomerRepository
 */
export default interface CustomerRepository {
  /**
   * Creates or updates a customer record.
   *
   * If a customer already exists (based on unique constraints), the record is updated.
   * Otherwise, a new customer is created.
   *
   * @param {CustomerCreate} data - The data used to create or update the customer.
   * @returns {Promise<Customer>} A promise that resolves to the created or updated customer.
   */
  upsertCustomer(data: CustomerCreate): Promise<Customer>;
}
