import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";
import type { Contact } from "~/@types/contact";
import {sendLogEvent} from "~/api/send-log-event";
import {EVENT_MESSAGES} from "~/config/constants";

/**
 * Sends a POST request to create a contact in the Yespo API.
 *
 * @param {Object} params - The function parameters.
 * @param {string} params.apiKey - The API key used for authentication.
 * @param {Contact} params.contactData - The contact data to be created.
 * @returns {Promise<void>} A promise that resolves when the contact is created successfully.
 *
 * @throws Will re-throw errors unless the error message includes 'Duplicated request'.
 *
 * Uses `fetchWithErrorHandling` to perform the HTTP request and handle errors.
 */

export const createContact = async ({
  apiKey,
  contactData,
  domain
}: {
  apiKey: string;
  contactData: Contact;
  domain: string;
}): Promise<void> => {
  const url = `${process.env.API_URL}/contact`;
  const authHeader = getAuthHeader(apiKey);
  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(contactData),
  };

  try {
    const response = await fetchWithErrorHandling(url, options);

    await sendLogEvent({
      errorMessage: '',
      data: JSON.stringify({domain}),
      message: EVENT_MESSAGES.WEB_TRACKING_CUSTOMER_DATA_SUCCESS,
      logLevel: 'INFO'
    })

    return response;
  } catch (error: any) {
    console.error("Error creating contact:", error?.message);
    await sendLogEvent({
      errorMessage: `Error creating contact: ${error?.message}`,
      data: JSON.stringify({domain}),
      message: EVENT_MESSAGES.WEB_TRACKING_CUSTOMER_DATA_ERROR,
      logLevel: 'ERROR'
    })

    if (!error?.message?.includes("Duplicated request")) {
      throw new Error(error.message);
    }
  }
};
