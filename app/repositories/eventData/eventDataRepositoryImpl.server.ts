import type IEventDataRepository from "./eventDataRepository.server"
import {Prisma, type PrismaClient} from "@prisma/client";
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
   * Retrieves event data of a shop by the provided cart token.
   *
   * @param {number} shopId - The shop that owns the cart.
   * @param {string} cartToken - The token identifying the cart.
   * @returns {Promise<EventDataRequest|null>} A promise resolving to the event data or `null` if not found.
   */
  async getEventData(shopId: number, cartToken: string): Promise<EventDataRequest | null>{
    return this.database.eventData.findFirst({
      where: {
        cartToken,
        shopId
      },
      include: {
        customer: true
      }
    })
  }

  /**
   * Creates or updates an event data record using the provided input.
   *
   * A cart keeps the first `sc` it was saved with. When the same shop sends
   * the same `sc`, the record is updated. When the cart exists with another
   * `sc`, only its `ttl` is extended. A cart of another shop is not changed.
   *
   * @param {EventDataCreate} data - The event data to create or update.
   * @returns {Promise<void>} Resolves when the record is saved or left unchanged.
   */
  async createEventData(data: EventDataCreate): Promise<void> {
    const {cartToken, sc, marketId, ttl, shopId, customerId} = data;
    const customer = customerId ? {connect: {customerId}} : undefined;
    try {
      await this.database.eventData.upsert({
        where: {
          cartToken,
          shopId,
          sc
        },
        create: {
          cartToken,
          sc,
          marketId,
          ttl,
          shop: {connect: {id: shopId}},
          customer
        },
        update: {
          marketId,
          ttl,
          customer
        }
      })
    } catch (error) {
      // The cart exists with another sc or belongs to another shop: the
      // where above did not match it, so create hit the cartToken key.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        await this.database.eventData.updateMany({
          where: {cartToken, shopId},
          data: {ttl}
        })
        return
      }
      throw error
    }
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
