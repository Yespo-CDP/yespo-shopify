interface Channel {
  type: string;
  value: string;
}

interface Address {
  town: string;
  address: string;
  postcode: string;
}

export interface Contact {
  firstName: string;
  lastName: string;
  channels: Channel[];
  externalCustomerId: string;
  address?: Address;
}

export interface ContactsResponse {
  failedContacts?: object | object[];
  asyncSessionId?: string;
  id?: number;
}
