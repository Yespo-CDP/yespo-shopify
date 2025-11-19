import {deleteAccessToken} from "~/api/delete-access-token.server";

/**
 * Service function that handles deleting a Shopify access token.
 *
 * This function wraps the {@link deleteAccessToken} API call and provides
 * error handling for any issues that occur during the deletion process.
 *
 * @async
 * @function deleteAccessTokenService
 * @param {Object} params - The parameters for deleting the access token.
 * @param {string} params.apiKey - The API key used to authenticate the deletion request.
 * @returns {Promise<void>} Resolves when the access token has been successfully deleted.
 * @throws {Error} Logs an error to the console if the operation fails.
 *
 * @example
 * await deleteAccessTokenService({
 *   apiKey: "your-api-key"
 * });
 */

export const deleteAccessTokenService = async({
  apiKey,
}: {
  apiKey: string;
}): Promise<void> => {
  try {
    await deleteAccessToken({
      apiKey,
    })
  } catch (error) {
    console.error("Error occurred in Delete Access Token Service", error);
  }
}
