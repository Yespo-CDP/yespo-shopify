import type {CustomerDataRequestCreate, GdprCustomerDataRequest} from "~/@types/customerData";

export default interface CustomerDataRepository {
  createCustomerDataRequest(data: CustomerDataRequestCreate): Promise<GdprCustomerDataRequest>;
}
