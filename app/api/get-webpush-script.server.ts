import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";
import {sendLogEvent} from "~/api/send-log-event";
import {EVENT_MESSAGES} from "~/config/constants";

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
}): Promise<string> => {
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
    const res = (await fetchWithErrorHandling(url, options))
    const response = res.responseData as {
      script?: string;
    };
    const { script } = response;

    if (!script) {
      await sendLogEvent({
        errorMessage: 'Web push script not retrieved',
        data: JSON.stringify({
          domain,
          responseBody: response,
          statusCode: res.status
        }),
        message: EVENT_MESSAGES.GET_WEB_PUSH_DOMAIN_FAILED,
        logLevel: 'ERROR'
      })

      throw new Error("requestScriptError");
    }

    await sendLogEvent({
      errorMessage: '',
      data: JSON.stringify({
        domain,
        responseBody: response,
        statusCode: res.status
      }),
      message: EVENT_MESSAGES.GET_WEB_PUSH_DOMAIN_SUCCESS,
      logLevel: 'INFO'
    })

    return script;
  } catch (error: any) {
    console.error("Error fetching webpush script:", error);

    await sendLogEvent({
      errorMessage: error?.message,
      data: JSON.stringify({
        domain,
        responseBody: error,
        statusCode: error?.status ?? 500
      }),
      message: EVENT_MESSAGES.GET_WEB_PUSH_DOMAIN_FAILED,
      logLevel: 'ERROR'
    })

    throw new Error("requestScriptError");
  }
};
