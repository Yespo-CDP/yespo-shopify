import type {EventDataCreate, EventDataRequest} from "~/@types/eventData";

export default interface EventDataRepository {
  getEventData(cartToken: string): Promise<EventDataRequest | null>;
  createEventData(data: EventDataCreate): Promise<EventDataRequest>;
}
