import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";
import {sendLogEvent} from "~/api/send-log-event";
import {EVENT_MESSAGES} from "~/config/constants";

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
export const getGeneralScript = async ({
  apiKey,
  domain,
  orgId
}: {
  apiKey: string,
  domain: string;
  orgId?: number | null;
}) => {
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

    await sendLogEvent({
      orgId,
      errorMessage: '',
      data: JSON.stringify({
        domain,
        responseBody: {},
        statusCode: response.status
      }),
      message: EVENT_MESSAGES.GET_SCRIPT_SUCCESS,
      logLevel: 'INFO'
    })

    return response.responseData;
  } catch (error: any) {
    console.error("Error fetching general script:", error);

    await sendLogEvent({
      orgId,
      errorMessage: error?.message,
      data: JSON.stringify({
        domain,
        responseBody: {},
        statusCode: error?.status ?? 500
      }),
      message: EVENT_MESSAGES.GET_SCRIPT_FAILED,
      logLevel: 'ERROR'
    })
    throw new Error("requestScriptError");
  }
};
