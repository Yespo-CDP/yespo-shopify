import {GdprCustomerDataRequest} from "@prisma/client";

class CustomerDataRequestCreate {
}

/**
 * Interface defining methods for managing GDPR-related customer data requests.
 */
export default interface CustomerDataRepository {
  /**
   * Creates a new customer data request record.
   *
   * @param {CustomerDataRequestCreate} data - The data required to create the customer data request.
   * @returns {Promise<GdprCustomerDataRequest>} A promise that resolves to the created GDPR customer data request entity.
   */
  createCustomerDataRequest(data: CustomerDataRequestCreate): Promise<GdprCustomerDataRequest>;
}
