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
   * Retrieves event data by cart token.
   *
   * @param {string} cartToken - The token identifying the cart.
   * @returns {Promise<EventDataRequest|null>} A promise that resolves to the event data, or null if not found.
   */
  getEventData(cartToken: string): Promise<EventDataRequest | null>;

  /**
   * Creates a new event data record.
   *
   * @param {EventDataCreate} data - The data to be stored.
   * @returns {Promise<EventDataRequest>} A promise that resolves to the created event data record.
   */
  createEventData(data: EventDataCreate): Promise<EventDataRequest>;

  /**
   * Deletes all expired or old event data in bulk.
   *
   * This method performs a cleanup operation. It does not return a value.
   */
  bulkDeleteEventsData(): void;
}
