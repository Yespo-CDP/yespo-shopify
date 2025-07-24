import type IEventDataRepository from "./eventDataRepository.server"
import type {PrismaClient} from "@prisma/client";
import type {EventDataCreate, EventDataRequest} from "~/@types/eventData";

/**
 * Implementation of the IEventDataRepository interface using Prisma for data persistence.
 *
 * This class manages operations related to event data, including fetching by cart token,
 * upserting records, and bulk deletion of expired entries.
 *
 * @class EventDataRepositoryImpl
 * @implements {IEventDataRepository}
 */
export default class EventDataRepositoryImpl implements IEventDataRepository {
  /**
   * Creates an instance of EventDataRepositoryImpl.
   *
   * @param {PrismaClient} database - The Prisma client instance used to access the database.
   */
  constructor(readonly database: PrismaClient) {}

  /**
   * Retrieves event data by the provided cart token.
   *
   * @param {string} cartToken - The token identifying the cart.
   * @returns {Promise<EventDataRequest|null>} A promise resolving to the event data or `null` if not found.
   */
  async getEventData(cartToken: string): Promise<EventDataRequest | null>{
    return this.database.eventData.findFirst({
      where: {
        cartToken
      },
      include: {
        customer: true
      }
    })
  }

  /**
   * Creates or updates an event data record using the provided input.
   *
   * If a record with the given `cartToken` exists, it is updated. Otherwise, a new record is created.
   *
   * @param {EventDataCreate} data - The event data to create or update.
   * @returns {Promise<EventDataRequest>} A promise resolving to the created or updated event data.
   */
  async createEventData(data: EventDataCreate): Promise<EventDataRequest> {
    return this.database.eventData.upsert({
      where: {
        cartToken: data.cartToken
      },
      create: {
        ...data
      },
      update: {
        sc: data.sc,
        customer: data.customer
      }
    })
  }

  /**
   * Deletes all event data records whose `ttl` (time to live) is older than the current time.
   *
   * @returns {Promise<void>} A promise that resolves when deletion is complete.
   */
  async bulkDeleteEventsData() {
    await this.database.eventData.deleteMany({
      where: {
        ttl: {
          lt: new Date(),
        },
      },
    });
  }
}
