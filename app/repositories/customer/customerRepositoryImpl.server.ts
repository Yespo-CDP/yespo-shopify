import type ICustomerRepository from "~/repositories/customer/customerRepository.server";
import type {PrismaClient} from "@prisma/client";
import type {Customer, CustomerCreate} from "~/@types/customer";

/**
 * Implementation of the ICustomerRepository interface using Prisma as the database client.
 *
 * This class provides a method to upsert (insert or update) customer records.
 *
 * @class CustomerRepositoryImpl
 * @implements {ICustomerRepository}
 */
export default class CustomerRepositoryImpl implements ICustomerRepository {
  /**
   * Creates an instance of CustomerRepositoryImpl.
   *
   * @param {PrismaClient} database - The Prisma client instance used for database operations.
   */
  constructor(readonly database: PrismaClient) {}

  /**
   * Creates or updates a customer record in the database.
   *
   * If a customer with the given `customerId` already exists, it is updated.
   * Otherwise, a new customer record is created.
   *
   * @param {CustomerCreate} data - The customer data to create or update.
   * @returns {Promise<Customer>} A promise that resolves to the upserted customer.
   */
  async upsertCustomer(data: CustomerCreate): Promise<Customer> {
    const {customerId, email, phone, firstName, lastName} = data;
    const fields = {email, phone, firstName, lastName};
    return this.database.customer.upsert({
      where: {
        customerId
      },
      create: {
        customerId,
        ...fields
      },
      update: fields
    })
  }

  /**
   * Deletes a customer record by `customerId`. Does nothing if the record does not exist.
   *
   * @param {string} customerId - The Shopify customer ID.
   * @returns {Promise<void>} A promise that resolves when the deletion is complete.
   */
  async deleteCustomer(customerId: string): Promise<void> {
    await this.database.customer.deleteMany({where: {customerId}});
  }
}
