import { getAuthHeader } from "~/utils/auth";
import createMetafield from "~/shopify/mutations/create-metafield.server";

const GENERAL_SCRIPT_HANDLE =
  process.env.GENERAL_SCRIPT_HANDLE ?? "yespo-script";

const connectScriptService = async ({
  shopId,
  apiKey,
  admin,
}: {
  shopId: string;
  apiKey: string;
  admin: any;
}) => {
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

    const metafield = await createMetafield({
      shopId,
      admin,
      value: responseParse,
      key: GENERAL_SCRIPT_HANDLE,
    });

    if (!metafield) {
      throw new Error("requestScriptError");
    }

    return true;
  } catch (error: any) {
    throw new Error("requestScriptError");
  }
};

export default connectScriptService;
