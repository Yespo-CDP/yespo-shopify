import {createContact} from "~/api/create-contact";

/**
 * Creates a contact using the provided payload and API key.
 *
 * Extracts email and phone from the payload,
 * constructs contact data with first and last names and external customer ID,
 * and calls `createContact` service to create the contact in the system.
 *
 * Any errors during the process are caught and logged.
 *
 * @param {any} payload - The customer data payload containing contact info.
 * @param {string} apiKey - The API key used for authentication with the contact service.
 * @returns {Promise<void>} A promise that resolves when the contact creation completes.
 */
export const createContactService = async (payload: any, apiKey: string) => {
  try {
    const channels = []

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
    }

    const contactData = {
      firstName: payload.first_name || '',
      lastName: payload.last_name || '',
      channels,
      externalCustomerId: payload.id.toString(),
    }

    await createContact({
      apiKey,
      contactData
    })
  } catch (error: any) {
    console.error(error);
  }
}
