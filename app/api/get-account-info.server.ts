import type { Account } from "~/@types/account";
import { getAuthHeader } from "~/utils/auth";

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
}: {
  apiKey: string;
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
      throw new Error("invalidApiKey");
    }

    if (!response.ok) {
      throw new Error("unknownError");
    }

    return responseParse;
  } catch (error: any) {
    const message = error?.message ?? "unknownError";
    throw new Error(message);
  }
};
