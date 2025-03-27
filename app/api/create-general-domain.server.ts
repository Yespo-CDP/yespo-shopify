import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";

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
    } else {
      throw new Error("createGeneralDomainError");
    }
  }
};
