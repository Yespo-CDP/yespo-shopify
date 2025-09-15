import type { Contact } from "~/@types/contact";
import type { CustomerData } from "~/@types/customer";

/**
 * Convert Shopify Customer data to Yespo Contact data.
 *
 * This function maps Shopify `CustomerData` fields into Yespo `Contact` format.
 *
 * **Shopify Customers API (GraphQL):**  
 * https://shopify.dev/docs/api/admin-graphql/latest/queries/customers
 *
 * **Yespo Contacts Bulk Update API:**  
 * https://docs.esputnik.com/reference/contactsbulkupdate-1
 *
 * **Field Mapping:**
 * - `customer.id` → `externalCustomerId`
 * - `customer.firstName` → `firstName`
 * - `customer.lastName` → `lastName`
 * - `customer.defaultEmailAddress.emailAddress` → `channels[type=email].value`
 * - `customer.defaultPhoneNumber.phoneNumber` → `channels[type=sms].value`
 * - `customer.defaultAddress.phone` (if defaultPhoneNumber not exist) → `channels[type=sms].value`
 * - `customer.defaultAddress.city` → `address.town`
 * - `customer.defaultAddress.address1` → `address.address`
 * - `customer.defaultAddress.zip` → `address.postcode`
 *
 * @param {CustomerData} customer - Shopify customer data.
 * @returns {Promise<Contact>} A promise that resolves when the contact is created successfully.
 *
 * @example
 * const contact = await createContactPayload(customer);
 * console.log(contact);
 */

export const createContactPayload = (customer: CustomerData): Contact => {
  const channels = [];
  const customerFirstName = customer?.firstName ?? "";
  const customerLastName = customer?.lastName ?? "";
  const customerEmail = customer?.defaultEmailAddress?.emailAddress;
  const customerPhone = customer?.defaultPhoneNumber?.phoneNumber;
  const customerAddress = customer?.defaultAddress;
  const customerAddressPhone = customerAddress?.phone;
  const externalCustomerId = customer?.id?.split("/").pop() ?? "";
  let address = undefined;

  if (customerEmail) {
    channels.push({
      type: "email",
      value: customerEmail,
    });
  }

  if (customerPhone) {
    channels.push({
      type: "sms",
      value: customerPhone,
    });
  } else if (customerAddressPhone) {
    channels.push({
      type: "sms",
      value: customerAddressPhone,
    });
  }

  if (customerAddress) {
    address = {
      town: customerAddress?.city ?? "",
      address: customerAddress?.address1 ?? "",
      postcode: customerAddress?.zip ?? "",
    };
  }

  const contact: Contact = {
    firstName: customerFirstName,
    lastName: customerLastName,
    channels,
    externalCustomerId: externalCustomerId,
    address: address,
  };

  return contact;
};
