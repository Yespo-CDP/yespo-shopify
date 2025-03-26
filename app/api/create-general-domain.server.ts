import { getAuthHeader } from "~/utils/auth";

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
    const response = await fetch(url, options);
    const responseParse = (await response.json()) as { result: string };

    if (!response.ok) {
      throw new Error("createDomainError");
    }

    return responseParse;
  } catch (error: any) {
    console.error("Error creating general domain:", error);
    throw new Error("createDomainError");
  }
};
