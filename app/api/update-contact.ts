import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";
import type { Contact } from "~/@types/contact";
import {sendLogEvent} from "~/api/send-log-event";
import {EVENT_MESSAGES} from "~/config/constants";

/**
 * Sends a POST request to update a contact in the Yespo API.
 *
 * @param {Object} params - The function parameters.
 * @param {string} params.apiKey - The API key used for authentication.
 * @param {Contact} params.contactData - The contact data to be updated.
 * @returns {Promise<void>} A promise that resolves when the contact update completes successfully.
 *
 * @throws Will re-throw errors unless the error message includes 'Duplicated request'.
 *
 * Uses `fetchWithErrorHandling` to perform the HTTP request and handle errors.
 */

export const updateContact = async ({
  apiKey,
  contactData,
  domain,
  orgId
}: {
  apiKey: string;
  contactData: Contact;
  domain: string;
  orgId?: number | null;
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
      orgId,
      errorMessage: '',
      data: {
        domain,
        requestBody: contactData,
        responseBody: response.responseData,
        statusCode: response.status
      },
      message: EVENT_MESSAGES.CUSTOM_LOG_UPDATE_YESPO_CONTACT_SUCCESS,
      logLevel: 'INFO'
    })

    return response.responseData;
  } catch (error: any) {
    console.error("Error updating contact:", error?.message);

    await sendLogEvent({
      orgId,
      errorMessage: `Error updating contact: ${error?.message}`,
      data: {
        domain,
        requestBody: contactData,
        responseBody: error,
        statusCode: error?.status ?? 400
      },
      message: EVENT_MESSAGES.CUSTOM_LOG_UPDATE_YESPO_CONTACT_ERROR,
      logLevel: 'ERROR'
    })

    if (!error?.message?.includes("Duplicated request")) {
      throw new Error(error.message);
    }
  }
};
