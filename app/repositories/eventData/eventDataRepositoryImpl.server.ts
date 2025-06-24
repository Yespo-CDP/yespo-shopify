import type IEventDataRepository from "./eventDataRepository.server"
import type {PrismaClient} from "@prisma/client";
import type {EventDataCreate, EventDataRequest} from "~/@types/eventData";

export default class EventDataRepositoryImpl implements IEventDataRepository {
  constructor(readonly database: PrismaClient) {}

  async createEventData(data: EventDataCreate): Promise<EventDataRequest> {
    return this.database.eventData.upsert({
      where: {
        cartToken: data.cartToken
      },
      create: {
        ...data
      },
      update: {
        sc: data.sc
      }
    })
  }
}
