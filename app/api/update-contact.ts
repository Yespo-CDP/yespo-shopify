import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";
import {Contact} from "~/@types/contact";

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
  contactData
}: {
  apiKey: string;
  contactData: Contact
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
    return response;
  } catch (error: any) {
    console.error("Error updating contact:", error?.message);
    if (!error?.message?.includes('Duplicated request')) {
      throw new Error(error.message);
    }
  }
};
