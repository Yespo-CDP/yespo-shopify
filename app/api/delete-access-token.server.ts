import {fetchWithErrorHandling} from "~/utils/fetchWithErrorHandling";
import {getAuthHeader} from "~/utils/auth";
import {sendLogEvent} from "~/api/send-log-event";
import {EVENT_MESSAGES} from "~/config/constants";

/**
 * Deletes a stored Shopify access token from the backend.
 *
 * This function sends an authenticated DELETE request to your API endpoint
 * to remove the access token associated with the provided API key.
 *
 * @async
 * @function deleteAccessToken
 * @param {Object} params - The parameters for deleting the access token.
 * @param {string} params.apiKey - The API key used to authenticate the request.
 * @returns {Promise<void>} Resolves when the access token is successfully deleted.
 * @throws {Error} Logs an error if the request fails.
 *
 * @example
 * await deleteAccessToken({
 *   apiKey: "your-api-key"
 * });
 */

export const deleteAccessToken = async ({
  apiKey,
  domain,
  orgId
}: {
  apiKey: string;
  domain: string;
  orgId?: number | null;
}): Promise<void> => {
  const url = `${process.env.API_URL}/shopify/token`;
  const authHeader = getAuthHeader(apiKey);
  const options = {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      Authorization: authHeader,
    },
  };
  try {
    const res = await fetchWithErrorHandling(url, options);
    console.log('DELETE access token', res)
  } catch (error: any) {
    console.error("Error deleting access token:", error);
    await sendLogEvent({
      orgId,
      errorMessage: `Access token is not deleted`,
      data: JSON.stringify({
        domain,
        requestBody: {},
        responseBody: error,
        statusCode: error?.status ?? 500
      }),
      message: EVENT_MESSAGES.CUSTOM_LOG_DELETE_ACCESS_TOKEN_ERROR,
      logLevel: 'ERROR'
    })
  }
}
