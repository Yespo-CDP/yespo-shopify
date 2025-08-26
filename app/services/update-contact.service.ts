import {updateContact} from "~/api/update-contact";
import type {Contact} from "~/@types/contact";

/**
 * Updates a contact using the provided payload and API key.
 *
 * Extracts communication channels (email and phone) from the payload,
 * including fallback to the default address phone if available.
 * Also extracts address information from the payload's default address.
 * Constructs a `Contact` object with personal and contact details,
 * then calls `updateContact` service to perform the update.
 *
 * @param {any} payload - The customer data payload containing updated contact info.
 * @param {string} apiKey - The API key used for authentication with the contact service.
 * @returns {Promise<void>} A promise that resolves when the contact update completes.
 */
export const updateContactService = async (payload: any, apiKey: string) => {
  const channels = []
  let address = undefined

  if (!payload) {
    console.error('Update customer payload is empty')
    return null
  }

  if (payload.email) {
    channels.push({
      type: 'email',
      value: payload.email,
    })
  }

  if (payload.phone) {
    channels.push({
      type: 'sms',
      value: payload.phone,
    })
  } else if (payload.default_address?.phone) {
    channels.push({
      type: 'sms',
      value: payload.default_address.phone,
    })
  }

  if (payload.default_address) {
    address = {
      town: payload.default_address.city || '',
      address: payload.default_address.address1 || '',
      postcode: payload.default_address.zip || '',
    }
  }

  const contactData: Contact = {
    firstName: payload.first_name || '',
    lastName: payload.last_name || '',
    channels,
    externalCustomerId: payload.id.toString(),
    address: address
  }

  await updateContact({
    apiKey,
    contactData
  })
}
