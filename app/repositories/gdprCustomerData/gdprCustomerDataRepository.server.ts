import type {GdprCustomerDataRequestCreate, GdprCustomerDataRequest} from "~/@types/gdprCustomerData";

/**
 * Interface for managing GDPR customer data requests.
 *
 * Provides a method to create a new GDPR data request for a customer.
 *
 * @interface GdprCustomerDataRepository
 */
export default interface GdprCustomerDataRepository {
  /**
   * Creates a new GDPR customer data request.
   *
   * @param {GdprCustomerDataRequestCreate} data - The data required to create a GDPR request.
   * @returns {Promise<GdprCustomerDataRequest>} A promise that resolves to the created GDPR data request.
   */
  createGdprCustomerDataRequest(data: GdprCustomerDataRequestCreate): Promise<GdprCustomerDataRequest>;
}
