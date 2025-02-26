import { getAuthHeader } from "~/utils/auth";
import createMetafield from "~/shopify/mutations/create-metafield.server";
import checkThemeExtensionService from "./check-theme-extension.server";

const connectScriptService = async ({
  shopId,
  apiKey,
  admin,
}: {
  shopId: string;
  apiKey: string;
  admin: any;
}): Promise<{
  isScriptExist: boolean;
  isThemeExtensionActive: boolean;
}> => {
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
      key: process.env.SCRIPT_HANDLE ?? "yespo-script",
    });

    if (!metafield) {
      throw new Error("requestScriptError");
    }

    const isThemeExtensionActive = await checkThemeExtensionService({ admin });

    return {
      isThemeExtensionActive,
      isScriptExist: true,
    };
  } catch (error: any) {
    throw new Error("requestScriptError");
  }
};

export default connectScriptService;
