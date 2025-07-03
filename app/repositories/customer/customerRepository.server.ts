import type { Customer, CustomerCreate } from "~/@types/customer";


export default interface CustomerRepository {
  upsertCustomer(data: CustomerCreate): Promise<Customer>;
}
