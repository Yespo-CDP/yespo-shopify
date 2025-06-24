import type {EventDataCreate, EventDataRequest} from "~/@types/eventData";

export default interface EventDataRepository {
  createEventData(data: EventDataCreate): Promise<EventDataRequest>;
}
