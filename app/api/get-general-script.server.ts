import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";

/**
 * Fetches the general script content from the Yespo API.
 *
 * Sends a GET request to the `/site/script` endpoint with authorization headers.
 *
 * @param {Object} params - The parameters object.
 * @param {string} params.apiKey - The API key used for authentication.
 * @returns {Promise<string>} A promise that resolves to the script content as plain text.
 *
 * @throws Will throw an error with message "requestScriptError" if the request fails.
 */
export const getGeneralScript = async ({ apiKey }: { apiKey: string }) => {
  const url = `${process.env.API_URL}/site/script`;
  const authHeader = getAuthHeader(apiKey);
  const options = {
    method: "GET",
    headers: {
      accept: "text/plain",
      Authorization: authHeader,
    },
  };

  try {
    const response = await fetchWithErrorHandling(url, options);

    return response;
  } catch (error: any) {
    console.error("Error fetching general script:", error);
    throw new Error("requestScriptError");
  }
};
