import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";

/**
 * Creates a general domain record in the Yespo API.
 *
 * Sends a POST request to register a domain associated with the given API key.
 * Handles specific error messages and throws corresponding custom errors.
 *
 * @param {Object} params - The parameters object.
 * @param {string} params.apiKey - The API key used for authentication.
 * @param {string} params.domain - The domain name to register.
 * @returns {Promise<{ result: string }>} A promise that resolves with the API response containing the result.
 *
 * @throws Will throw specific errors:
 * - "domainAlreadyRegisteredError" if the domain is already registered.
 * - "domainCantBeReachedError" if the domain cannot be reached.
 * - "createGeneralDomainError" for other errors.
 */
export const createGeneralDomain = async ({
  apiKey,
  domain,
}: {
  apiKey: string;
  domain: string;
}): Promise<{ result: string }> => {
  const url = `${process.env.API_URL}/site/domains`;
  const authHeader = getAuthHeader(apiKey);
  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ domain }),
  };

  try {
    const response = await fetchWithErrorHandling(url, options);

    return response;
  } catch (error: any) {
    console.error("Error creating general domain:", error?.message);
    if (error?.message?.includes("Domain is already registered")) {
      throw new Error("domainAlreadyRegisteredError");
    } else if (error?.message?.includes("Domain can't be reached")) {
      throw new Error("domainCantBeReachedError");
    } else {
      throw new Error("createGeneralDomainError");
    }
  }
};
