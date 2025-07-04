import type ICustomerDataRepository from './gdprCustomerDataRepository.server'
import type {PrismaClient} from "@prisma/client";
import type {GdprCustomerDataRequestCreate, GdprCustomerDataRequest} from "~/@types/gdprCustomerData";

export default class GdprCustomerDataRepositoryImpl implements ICustomerDataRepository {
  constructor(readonly database: PrismaClient) {}

  async createGdprCustomerDataRequest(data: GdprCustomerDataRequestCreate): Promise<GdprCustomerDataRequest> {
    return this.database.gdprCustomerDataRequest.create({
      data
    })
  }
}
