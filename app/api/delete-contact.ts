import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";
import {sendLogEvent} from "~/api/send-log-event";
import {EVENT_MESSAGES} from "~/config/constants";

/**
 * Sends a DELETE request to remove a contact by external customer ID.
 *
 * Optionally erases the contact data permanently based on the `erase` flag.
 *
 * @param {Object} params - The parameters object.
 * @param {string} params.apiKey - The API key used for authentication.
 * @param {string} params.externalCustomerId - The external customer ID of the contact to delete.
 * @param {boolean} params.erase - If true, permanently erases the contact data.
 * @returns {Promise<void>} A promise that resolves when the contact deletion completes.
 *
 * @throws Will re-throw errors unless the error message includes 'not found'.
 *
 * Uses `fetchWithErrorHandling` to perform the HTTP request and handle errors.
 */
export const deleteContact = async ({
  apiKey,
  externalCustomerId,
  erase = false,
  domain
}: {
  apiKey: string;
  externalCustomerId: string,
  erase: boolean
  domain: string;
}): Promise<void> => {
  const url = `${process.env.API_URL}/contact?externalCustomerId=${externalCustomerId}&erase=${erase}`;
  const authHeader = getAuthHeader(apiKey);
  const options = {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      Authorization: authHeader,
    },
  };

  try {
    const response = await fetchWithErrorHandling(url, options);
    return response;
  } catch (error: any) {
    console.error("Error deleting contact:", error?.message);
    await sendLogEvent({
      errorMessage: `Error deleting contact: ${error?.message}`,
      data: JSON.stringify({domain}),
      message: EVENT_MESSAGES.CUSTOM_LOG_DELETE_YESPO_CONTACTS_ERROR,
      logLevel: 'ERROR'
    })
    if (!error?.message.includes('not found')) {
      throw new Error(error.message);
    }
  }
};
