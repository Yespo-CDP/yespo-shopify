import type { Contact } from "~/@types/contact";
import type { CustomerData } from "~/@types/customer";
import {
  resolveContactMarketId,
  type ContactMarketContext,
} from "~/services/market-tracking";

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
 * - `customer.defaultAddress.countryCodeV2` → `marketId` when that country is an enabled shop market; otherwise the shop backup region. Omitted when the customer has no country.
 *
 * @param {CustomerData} customer - Shopify customer data.
 * @param {ContactMarketContext | null} marketContext - Enabled market countries and the shop backup region. Null keeps the address country as-is.
 * @returns {Contact} Yespo contact payload.
 *
 * @example
 * const contact = await createContactPayload(customer);
 * console.log(contact);
 */

export const createContactPayload = (
  customer: CustomerData,
  marketContext: ContactMarketContext | null = null,
): Contact => {
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

  const marketId = resolveContactMarketId({
    countryCode: customerAddress?.countryCodeV2,
    marketContext,
    whenCountryMissing: "omit",
  });

  const contact: Contact = {
    firstName: customerFirstName,
    lastName: customerLastName,
    channels,
    externalCustomerId: externalCustomerId,
    address: address,
    ...(marketId ? { marketId } : {}),
  };

  return contact;
};
