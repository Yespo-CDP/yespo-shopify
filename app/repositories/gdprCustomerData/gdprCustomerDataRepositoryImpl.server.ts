import type ICustomerDataRepository from './gdprCustomerDataRepository.server'
import type {PrismaClient} from "@prisma/client";
import type {GdprCustomerDataRequestCreate, GdprCustomerDataRequest} from "~/@types/gdprCustomerData";

/**
 * Implementation of the ICustomerDataRepository interface for handling GDPR customer data requests.
 *
 * Uses Prisma as the underlying database client to persist GDPR data requests.
 *
 * @class GdprCustomerDataRepositoryImpl
 * @implements {ICustomerDataRepository}
 */
export default class GdprCustomerDataRepositoryImpl implements ICustomerDataRepository {
  /**
   * Creates an instance of GdprCustomerDataRepositoryImpl.
   *
   * @param {PrismaClient} database - The Prisma client instance for database operations.
   */
  constructor(readonly database: PrismaClient) {}

  /**
   * Creates a new GDPR customer data request record in the database.
   *
   * @param {GdprCustomerDataRequestCreate} data - The data required to create a GDPR request.
   * @returns {Promise<GdprCustomerDataRequest>} A promise that resolves to the created GDPR request.
   */
  async createGdprCustomerDataRequest(data: GdprCustomerDataRequestCreate): Promise<GdprCustomerDataRequest> {
    return this.database.gdprCustomerDataRequest.create({
      data
    })
  }
}
