import {sendAccessToken} from "~/api/send-access-token.server";

/**
 * Sends an access token to a specified domain using the provided API key.
 *
 * This service function wraps the {@link sendAccessToken} API call
 * and logs any errors that occur during the process.
 *
 * @async
 * @function sendAccessTokenService
 * @param {Object} params - The parameters for sending the access token.
 * @param {string} params.apiKey - The API key used for authentication.
 * @param {string} params.domain - The target domain to which the access token will be sent.
 * @param {string} params.accessToken - The access token to be sent.
 * @returns {Promise<void>} Resolves when the token has been sent successfully.
 * @throws {Error} Logs an error to the console if the operation fails.
 *
 * @example
 * await sendAccessTokenService({
 *   apiKey: "your-api-key",
 *   domain: "example.com",
 *   accessToken: "generated-access-token"
 * });
 */

export const sendAccessTokenService = async({
  apiKey,
  domain,
  accessToken
}: {
  apiKey: string;
  domain: string;
  accessToken: string;
}): Promise<void> => {
  try {
    await sendAccessToken({
      apiKey,
      domain,
      accessToken
    })
  } catch (error) {
    console.error("Error occurred in Send Access Token Service", error);
  }
}
