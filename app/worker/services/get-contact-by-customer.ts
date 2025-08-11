import type { Contact } from "~/@types/contact";
import type { CustomerData } from "~/@types/customer";

/**
 * Convert Shopify Customer data to Yespo contact data
 *
 * @param {CustomerData} customer - Shopify customer data.
 * @returns {Promise<Contact>} A promise that resolves when the contact is created successfully.
 *
 * @example
 * const contact = await getContactByCustomer(customer);
 * console.log(contact);
 */

export const getContactByCustomer = (customer: CustomerData): Contact => {
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
