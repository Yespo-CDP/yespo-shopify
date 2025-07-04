import type {GdprCustomerDataRequestCreate, GdprCustomerDataRequest} from "~/@types/gdprCustomerData";

export default interface GdprCustomerDataRepository {
  createGdprCustomerDataRequest(data: GdprCustomerDataRequestCreate): Promise<GdprCustomerDataRequest>;
}
