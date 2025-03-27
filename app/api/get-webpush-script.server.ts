import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";

export const getWebpushScript = async ({
  apiKey,
  domain,
}: {
  apiKey: string;
  domain: string;
}) => {
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
    const response = (await fetchWithErrorHandling(url, options)) as {
      script?: string;
    };
    const { script } = response;

    if (!script) {
      throw new Error("requestScriptError");
    }

    return script;
  } catch (error: any) {
    console.error("Error fetching webpush script:", error);
    throw new Error("requestScriptError");
  }
};
