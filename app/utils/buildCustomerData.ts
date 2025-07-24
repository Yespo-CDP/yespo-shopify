import type {ICartCustomer} from "~/@types/statusCart";
import type {Customer} from "~/@types/customer";

/**
 * Constructs a customer data object suitable for the cart tracking system from a customer input.
 *
 * Extracts and normalizes customer properties such as ID, name, phone, and email.
 * Prefers `customerId` over `id` if both exist, and supports multiple possible field naming conventions.
 *
 * @function buildCustomerData
 * @param {Customer | any} [customer] - The customer object, which may have various possible field names.
 * @returns {ICartCustomer} An object containing normalized customer data for cart tracking.
 *
 * @example
 * const customer = {
 *   customerId: "123",
 *   firstName: "John",
 *   lastName: "Doe",
 *   phone: "123456789",
 *   email: "john@example.com"
 * };
 * const cartCustomer = buildCustomerData(customer);
 */
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
