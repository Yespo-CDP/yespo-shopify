import type {EventDataCreate, EventDataRequest} from "~/@types/eventData";

/**
 * Interface for managing event data in the data store.
 *
 * Provides methods to retrieve, create, and bulk delete event-related data.
 *
 * @interface EventDataRepository
 */
export default interface EventDataRepository {
  /**
   * Retrieves event data of a shop by cart token.
   *
   * @param {number} shopId - The shop that owns the cart.
   * @param {string} cartToken - The token identifying the cart.
   * @returns {Promise<EventDataRequest|null>} A promise that resolves to the event data, or null if not found.
   */
  getEventData(shopId: number, cartToken: string): Promise<EventDataRequest | null>;

  /**
   * Creates or updates an event data record.
   *
   * @param {EventDataCreate} data - The data to be stored.
   * @returns {Promise<void>} Resolves when the record is saved or left unchanged.
   */
  createEventData(data: EventDataCreate): Promise<void>;

  /**
   * Deletes all expired or old event data in bulk.
   *
   * This method performs a cleanup operation. It does not return a value.
   */
  bulkDeleteEventsData(): void;
}
