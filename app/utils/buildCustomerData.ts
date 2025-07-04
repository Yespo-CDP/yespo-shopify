import type {ICartCustomer} from "~/@types/statusCart";
import type {Customer} from "~/@types/customer";

export const buildCustomerData = (customer?: Customer | any): ICartCustomer => {
  const customerData: ICartCustomer = {};

  if (!customer) return customerData;

  // Prefer customerId over id if both exist
  customerData.externalCustomerId =
    customer.customerId ?? customer.id?.toString();

  const firstName = customer.firstName ?? customer.first_name ?? '';
  const lastName = customer.lastName ?? customer.last_name ?? '';

  if (firstName || lastName) {
    customerData.user_name = `${firstName} ${lastName}`.trim();
  }

  if (customer.phone) {
    customerData.user_phone = customer.phone;
  }

  if (customer.email) {
    customerData.user_email = customer.email;
  }

  return customerData;
}
