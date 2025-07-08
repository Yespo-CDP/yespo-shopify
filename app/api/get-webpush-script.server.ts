import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";

/**
 * Fetches the web push script for a specific domain from the Yespo API.
 *
 * Sends a GET request to the `/site/webpush/script` endpoint with the domain query parameter
 * and authorization headers.
 *
 * @param {Object} params - The parameters object.
 * @param {string} params.apiKey - The API key used for authentication.
 * @param {string} params.domain - The domain for which to fetch the web push script.
 * @returns {Promise<string>} A promise that resolves to the web push script as a string.
 *
 * @throws Will throw an error with message "requestScriptError" if the script is not returned
 * or if the request fails.
 */
export const getWebpushScript = async ({
  apiKey,
  domain,
}: {
  apiKey: string;
  domain: string;
}) => {
  const url = `${process.env.API_URL}/site/webpush/script?domain=https://${domain}`;
  const authHeader = getAuthHeader(apiKey);
  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: authHeader,
    },
  };

  try {
    const response = (await fetchWithErrorHandling(url, options)) as {
      script?: string;
    };
    const { script } = response;

    if (!script) {
      throw new Error("requestScriptError");
    }

    return script;
  } catch (error: any) {
    console.error("Error fetching webpush script:", error);
    throw new Error("requestScriptError");
  }
};
