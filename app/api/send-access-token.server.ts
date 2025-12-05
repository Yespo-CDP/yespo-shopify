import {fetchWithErrorHandling} from "~/utils/fetchWithErrorHandling";
import {getAuthHeader} from "~/utils/auth";
import {sendLogEvent} from "~/api/send-log-event";
import {EVENT_MESSAGES} from "~/config/constants";

/**
 * Sends a Shopify access token to the specified backend endpoint.
 *
 * This function constructs an authenticated POST request to send
 * the store's domain and access token to your API for secure storage or processing.
 *
 * @async
 * @function sendAccessToken
 * @param {Object} params - The parameters for sending the access token.
 * @param {string} params.apiKey - The API key used to generate the authorization header.
 * @param {string} params.domain - The Shopify store domain associated with the access token.
 * @param {string} params.accessToken - The Shopify access token to send to the API.
 * @returns {Promise<void>} Resolves when the access token is successfully sent.
 * @throws {Error} Logs an error if the request fails.
 *
 * @example
 * await sendAccessToken({
 *   apiKey: "your-api-key",
 *   domain: "your-shop.myshopify.com",
 *   accessToken: "shpat_1234567890abcdef"
 * });
 */

export const sendAccessToken = async ({
  apiKey,
  domain,
  accessToken,
  orgId
}: {
  apiKey: string;
  domain: string;
  accessToken: string;
  orgId?: number | null;
}): Promise<void> => {
  const url = `${process.env.API_URL}/shopify/token`;
  const authHeader = getAuthHeader(apiKey);
  const requestBody = { domain, accessToken }
  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(requestBody),
  };
  try {
   const res = await fetchWithErrorHandling(url, options);
    console.log('SEND access token', res)
  } catch (error: any) {
    console.error("Error sending access token:", error);
    await sendLogEvent({
      orgId,
      errorMessage: `Access token not sent: ${error.message}`,
      data: JSON.stringify({
        domain,
        requestBody,
        responseBody: error,
        statusCode: error?.status ?? 500
      }),
      message: EVENT_MESSAGES.CUSTOM_LOG_SEND_ACCESS_TOKEN_ERROR,
      logLevel: 'ERROR'
    })
  }
}
