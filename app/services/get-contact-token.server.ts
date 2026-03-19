import {getContactAuthToken} from "~/api/get-contact-auth-token";
import {AppInboxContactData} from "~/@types/contact";

/**
 * Fetches an authentication token for a given contact.
 *
 * @async
 * @function getContactToken
 * @param {string} apiKey - Your API key used to authenticate the request.
 * @param {AppInboxContactData} contactData - The contact information for which the token is requested.
 * @returns {Promise<string>} A promise that resolves to the authentication token as a string.
 *                             Returns an empty string if an error occurs.
 *
 * @example
 * const apiKey = "your-api-key";
 * const contactData = { email: "user@example.com", name: "John Doe" };
 *
 * const token = await getContactToken(apiKey, contactData);
 * console.log(token); // "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 */

export const getContactToken = async (apiKey: string, contactData: AppInboxContactData) => {
  try {
    const response = await getContactAuthToken({
      apiKey,
      contactData
    })

    return response
  } catch (error: any)  {
    console.error(`Error receiving contact token: ${error.message}`);
    return ''
  }
}
