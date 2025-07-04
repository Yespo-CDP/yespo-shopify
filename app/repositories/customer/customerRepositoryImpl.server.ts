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
    return this.database.customer.upsert({
      where: {
        customerId: data.customerId
      },
      create: {
        ...data
      },
      update: {
        ...data
      }
    })
  }
}
