import type { EventDataRequest } from "@prisma/client";

export type EventDataRequest = EventDataRequest;
export interface EventDataCreate {
  cartToken: string;
  sc: string;
  marketId: string | null;
  ttl: Date;
  shopId: number;
  customerId?: string;
}
