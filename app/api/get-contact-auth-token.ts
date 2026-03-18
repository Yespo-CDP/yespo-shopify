import {fetchWithErrorHandling} from "~/utils/fetchWithErrorHandling";
import {AppInboxContactData} from "~/@types/contact";
import {getAuthHeader} from "~/utils/auth";

/**
 * Requests an authentication token for a specific contact from the ESPUTNIK API.
 *
 * @async
 * @function getContactAuthToken
 * @param {Object} params - The parameters object.
 * @param {string} params.apiKey - API key used for authorization.
 * @param {AppInboxContactData} params.contactData - The contact information to authenticate.
 * @returns {Promise<string>} A promise that resolves to the contact's auth token as a string.
 *                            Returns an empty string if an error occurs.
 *
 * @example
 * const apiKey = "your-api-key";
 * const contactData = { email: "user@example.com", name: "John Doe" };
 *
 * const token = await getContactAuthToken({ apiKey, contactData });
 * console.log(token); // "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 */

export const getContactAuthToken = async ({apiKey, contactData}: {apiKey: string; contactData: AppInboxContactData}) => {
  const url = `${process.env.ESPUTNIK_URL}/auth/contact/token`;
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
    return response.responseData?.token || '';
  } catch (error: any) {
    console.error(`Error receiving contact auth token: ${error.message}`);

    //TODO add log

    return ''
  }
}
