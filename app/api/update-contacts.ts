import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";
import type { Contact, ContactsResponse } from "~/@types/contact";

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
}: {
  apiKey: string;
  contactsData: Contact[];
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
    }),
  };

  try {
    const response = (await fetchWithErrorHandling(
      url,
      options,
    )) as ContactsResponse;

    return response;
  } catch (error: any) {
    console.error("Error updating contacts:", error?.message);
    if (!error?.message?.includes("Duplicated request")) {
      throw new Error(error.message);
    } else {
      throw new Error("Error updating contacts");
    }
  }
};
