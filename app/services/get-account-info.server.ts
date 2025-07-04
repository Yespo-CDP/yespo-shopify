import type { Account } from "~/@types/account";
import { getAuthHeader } from "~/utils/auth";

/**
 * Fetches Yespo account information using the provided API key.
 *
 * Sends a GET request to the account info endpoint with the necessary authentication header.
 *
 * @param {Object} params - Parameters object.
 * @param {string} params.apiKey - API key used for authentication.
 *
 * @returns {Promise<Account>} Resolves with the account information.
 *
 * @throws Will throw an error with message "invalidApiKey" if the API key is unauthorized (HTTP 401).
 * @throws Will throw an error with message "unknownError" for other unsuccessful responses or network errors.
 *
 * @example
 * const account = await getAccountInfoService({ apiKey: "your-api-key" });
 */
const getAccountInfoService = async ({
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

export default getAccountInfoService;
