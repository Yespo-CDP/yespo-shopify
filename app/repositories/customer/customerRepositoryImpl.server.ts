import type ICustomerRepository from "~/repositories/customer/customerRepository.server";
import type {PrismaClient} from "@prisma/client";
import type {Customer, CustomerCreate} from "~/@types/customer";

export default class CustomerRepositoryImpl implements ICustomerRepository {
  constructor(readonly database: PrismaClient) {}

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
