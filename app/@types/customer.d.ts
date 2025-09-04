import type { Prisma, Customer } from "@prisma/client";

export interface CustomerData {
  id: string;
  firstName?: string;
  lastName: string;
  defaultEmailAddress?: {
    emailAddress: string;
  };
  defaultPhoneNumber?: {
    phoneNumber: string;
  };
  defaultAddress?: {
    id: string;
    address1?: string;
    address2?: string;
    city?: string;
    province?: string;
    country?: string;
    zip?: string;
    phone?: string;
    provinceCode?: string;
    countryCodeV2?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CustomersResponse {
  customers: {
    nodes: CustomerData[];
    pageInfo: {
      startCursor?: string;
      endCursor?: string;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
}

export type Customer = Customer;
export type CustomerCreate = Prisma.CustomerCreateInput;
export type CustomerUpdate = Prisma.CustomerUpdateInput;
