import type ICustomerDataRepository from './customerDataRepository.server'
import {GdprCustomerDataRequest, PrismaClient} from "@prisma/client";

class CustomerDataRequestCreate {
}

/**
 * Implementation of the CustomerDataRepository interface using Prisma ORM.
 *
 * Provides methods to create GDPR-related customer data request records
 * in the database.
 */
export default class CustomerDataRepositoryImpl implements ICustomerDataRepository {
  /**
   * Creates a new instance of CustomerDataRepositoryImpl.
   *
   * @param {PrismaClient} database - The Prisma client instance for database operations.
   */
  constructor(readonly database: PrismaClient) {}

  /**
   * Creates a new GDPR customer data request record in the database.
   *
   * @param {CustomerDataRequestCreate} data - The data required to create the GDPR customer data request.
   * @returns {Promise<GdprCustomerDataRequest>} A promise that resolves to the created GDPR customer data request entity.
   */
  async createCustomerDataRequest(data: CustomerDataRequestCreate): Promise<GdprCustomerDataRequest> {
    return this.database.gdprCustomerDataRequest.create({
      data
    })
  }
}
