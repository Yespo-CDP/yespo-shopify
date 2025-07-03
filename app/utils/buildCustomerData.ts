import type {ICartCustomer} from "~/@types/statusCart";
import type {Customer} from "~/@types/customer";

export const buildCustomerData = (customer?: Customer): ICartCustomer => {
  const customerData: ICartCustomer = {};

  if (customer) {
    customerData.externalCustomerId = customer.customerId;

    if (customer.phone) {
      customerData.user_phone = customer.phone;
    }

    if (customer.email) {
      customerData.user_email = customer.email;
    }

    if (customer.firstName || customer.lastName) {
      customerData.user_name = `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
    }
  }

  return customerData;
}
