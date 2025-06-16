import type ICustomerDataRepository from './customerDataRepository.server'
import type {PrismaClient} from "@prisma/client";
import type {CustomerDataRequestCreate, GdprCustomerDataRequest} from "~/@types/customerData";

export default class CustomerDataRepositoryImpl implements ICustomerDataRepository {
  constructor(readonly database: PrismaClient) {}

  async createCustomerDataRequest(data: CustomerDataRequestCreate): Promise<GdprCustomerDataRequest> {
    return this.database.gdprCustomerDataRequest.create({
      data
    })
  }
}
