import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";
import type { Contact, ContactsResponse } from "~/@types/contact";
import {sendLogEvent} from "~/api/send-log-event";
import {EVENT_MESSAGES} from "~/config/constants";

/**
 * Sends a POST request to update the contacts array in the Yespo API.
 *
 * @param {Object} params - The input parameters.
 * @param {string} params.apiKey - The API key used for authentication.
 * @param {Contact[]} params.contactsData - The contact array data to be updated.
 * @returns {Promise<ContactsResponse>} A promise that resolves when the contacts update completes successfully.
 *
 * @throws Will re-throw errors unless the error message includes 'Duplicated request'.
 *
 * Uses `fetchWithErrorHandling` to perform the HTTP request and handle errors.
 */

export const updateContacts = async ({
  apiKey,
  contactsData,
  domain,
  orgId
}: {
  apiKey: string;
  contactsData: Contact[];
  domain: string;
  orgId?: number | null;
}): Promise<ContactsResponse> => {
  const url = `${process.env.API_URL}/contacts`;
  const authHeader = getAuthHeader(apiKey);
  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      contacts: contactsData,
      dedupeOn: "externalCustomerId",
      restoreDeleted: true,
    }),
  };

  try {
    const res = (await fetchWithErrorHandling(
      url,
      options,
    ));
    const response = res.responseData as ContactsResponse;

    await sendLogEvent({
      orgId,
      errorMessage: '',
      data: JSON.stringify({
        domain,
        requestBody: contactsData,
        responseBody: res.responseData,
        statusCode: res.status
      }),
      message: EVENT_MESSAGES.WEB_TRACKING_CUSTOMER_DATA_SUCCESS,
      logLevel: 'INFO'
    })

    return response;
  } catch (error: any) {
    console.error("Error updating contacts:", error?.message);

    await sendLogEvent({
      orgId,
      errorMessage: `Error updating contacts: ${error?.message}`,
      data: JSON.stringify({
        domain,
        requestBody: contactsData,
        responseBody: error,
        statusCode: error?.status ?? 400
      }),
      message: EVENT_MESSAGES.WEB_TRACKING_CUSTOMER_DATA_ERROR,
      logLevel: 'ERROR'
    })
    if (!error?.message?.includes("Duplicated request")) {
      throw new Error(error.message);
    } else {
      throw new Error("Error updating contacts");
    }
  }
};
