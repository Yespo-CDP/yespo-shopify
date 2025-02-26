import { getAuthHeader } from "~/utils/auth";
import createMetafield from "~/helpers/create-metafield";

const getScript = async ({
  shopId,
  apiKey,
  admin,
}: {
  shopId: string;
  apiKey: string;
  admin: any;
}): Promise<string> => {
  const url = `${process.env.API_URL}/site/script`;
  const authHeader = getAuthHeader(apiKey);
  const options = {
    method: "GET",
    headers: {
      accept: "text/plain",
      Authorization: authHeader,
    },
  };

  try {
    const response = await fetch(url, options);
    const responseParse = await response.text();

    if (!response.ok) {
      throw new Error("requestScriptError");
    }

    await createMetafield({
      shopId,
      admin,
      value: responseParse,
      key: process.env.SCRIPT_HANDLE ?? "yespo-script",
    });

    return responseParse;
  } catch (error: any) {
    throw new Error("requestScriptError");
  }
};

export default getScript;
