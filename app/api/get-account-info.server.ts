import type { Account } from "~/@types/account";
import { getAuthHeader } from "~/utils/auth";
import {sendLogEvent} from "~/api/send-log-event";
import {EVENT_MESSAGES} from "~/config/constants";

/**
 * Retrieves account information from the Yespo API using the provided API key.
 *
 * Sends a GET request to the `/account/info` endpoint with authorization headers.
 * Throws specific errors based on the response status or other failures.
 *
 * @param {Object} params - The parameters object.
 * @param {string} params.apiKey - The API key used for authentication.
 * @returns {Promise<Account>} A promise that resolves to the account information.
 *
 * @throws Will throw an error with message:
 * - "invalidApiKey" if the API key is unauthorized (HTTP 401).
 * - "unknownError" for other unsuccessful responses or unexpected errors.
 */
export const getAccountInfo = async ({
  apiKey,
  domain,
  orgId
}: {
  apiKey: string;
  domain: string;
  orgId?: number | null;
}): Promise<Account> => {
  const url = `${process.env.API_URL}/account/info`;
  const authHeader = getAuthHeader(apiKey);
  const options = {
    method: "GET",
    headers: {
      accept: "application/json; charset=UTF-8",
      Authorization: authHeader,
    },
  };

  try {
    const response = await fetch(url, options);
    const responseParse = (await response.json()) as Account;

    if (response.status === 401) {
      await sendLogEvent({
        orgId,
        errorMessage: `Get account info error: invalid api key`,
        data: {
          domain,
          requestBody: { apiKey },
          responseBody: responseParse,
          statusCode: response.status
        },
        message: EVENT_MESSAGES.CUSTOM_LOG_GET_ACCOUNT_INFO_ERROR,
        logLevel: 'ERROR'
      })
      throw new Error("invalidApiKey", );
    }

    if (!response.ok) {
      await sendLogEvent({
        orgId,
        errorMessage: `Get account info error`,
        data: {
          domain,
          requestBody: { apiKey },
          responseBody: responseParse,
          statusCode: response.status
        },
        message: EVENT_MESSAGES.CUSTOM_LOG_GET_ACCOUNT_INFO_ERROR,
        logLevel: 'ERROR'
      })
      throw new Error("unknownError");
    }

    return responseParse;
  } catch (error: any) {
    const message = error?.message ?? "unknownError";

    await sendLogEvent({
      orgId,
      errorMessage: `Get account info error: ${error.message}`,
      data: {
        domain,
        requestBody: { apiKey },
        responseBody: error,
        statusCode: error?.status ?? 500
      },
      message: EVENT_MESSAGES.CUSTOM_LOG_GET_ACCOUNT_INFO_ERROR,
      logLevel: 'ERROR'
    })
    throw new Error(message);
  }
};
