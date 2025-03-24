import { getAuthHeader } from "~/utils/auth";

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
    const response = await fetch(url, options);
    const responseParse = (await response.json()) as { script?: string };
    const { script } = responseParse;

    if (!response.ok || !script) {
      throw new Error("requestScriptError");
    }

    return script;
  } catch (error: any) {
    console.log(error);
    throw new Error("requestScriptError");
  }
};
