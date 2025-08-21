import { updateContact } from "~/api/update-contact";
import { customerSyncRepository } from "~/repositories/repositories.server";
import type { Contact } from "~/@types/contact";

/**
 * Updates a contact using the provided payload and API key.
 *
 * Extracts communication channels (email and phone) from the payload,
 * including fallback to the default address phone if available.
 * Also extracts address information from the payload's default address.
 * Constructs a `Contact` object with personal and contact details,
 * then calls `updateContact` service to perform the update.
 * 
 * **Shopify Customer Webhook (REST):**  
 * https://shopify.dev/docs/api/admin-rest/latest/resources/customer#resource-object
 *
 * **Yespo Add Contact API:**  
 * https://docs.esputnik.com/reference/addcontact-1
 *
 * **Field Mapping:**
 * - `payload.id` → `externalCustomerId`
 * - `payload.first_name` → `firstName`
 * - `payload.last_name` → `lastName`
 * - `payload.email` → `channels[type=email].value`
 * - `payload.phone` → `channels[type=sms].value`
 * - `payload.default_address.city` → `town`
 * - `payload.default_address.address1` → `address`
 * - `payload.default_address.zip` → `postcode`
 * - `payload.admin_graphql_api_id` → `customerId` (for db sync log)
 * - `payload.created_at` → `createdAt` (for db sync log)
 * - `payload.updated_at` → `updatedAt` (for db sync log)
 *
 * @param {any} payload - The customer data payload containing updated contact info.
 * @param {string} apiKey - The API key used for authentication with the contact service.
 * @param {string} shopId - The shop id for connect customer sync log to shop.
 * @returns {Promise<void>} A promise that resolves when the contact update completes.
 */
export const updateContactService = async (
  payload: any,
  apiKey: string,
  shopId: number,
) => {
  const channels = [];
  let address = undefined;

  if (!payload) {
    console.error("Update customer payload is empty");
    return null;
  }

  if (payload.email) {
    channels.push({
      type: "email",
      value: payload.email,
    });
  }

  if (payload.phone) {
    channels.push({
      type: "sms",
      value: payload.phone,
    });
  } else if (payload.default_address?.phone) {
    channels.push({
      type: "sms",
      value: payload.default_address.phone,
    });
  }

  if (payload.default_address) {
    address = {
      town: payload.default_address.city || "",
      address: payload.default_address.address1 || "",
      postcode: payload.default_address.zip || "",
    };
  }

  const contactData: Contact = {
    firstName: payload.first_name || "",
    lastName: payload.last_name || "",
    channels,
    externalCustomerId: payload.id.toString(),
    address: address,
  };

  await updateContact({
    apiKey,
    contactData,
  });

  await customerSyncRepository.createOrUpdateCustomerSync({
    customerId: payload.admin_graphql_api_id,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
    shop: {
      connect: {
        id: shopId,
      },
    },
  });
};
