import { getAuthHeader } from "~/utils/auth";
import createMetafield from "~/shopify/mutations/create-metafield.server";
import checkThemeExtensionService from "./check-theme-extension.server";

const WEB_PUSH_SCRIPT_HANDLE =
  process.env.WEB_PUSH_SCRIPT_HANDLE ?? "yespo-web-push-script";

const connectWebPushScriptService = async ({
  shopId,
  apiKey,
  domain,
  admin,
}: {
  shopId: string;
  apiKey: string;
  domain: string;
  admin: any;
}): Promise<{
  isScriptExist: boolean;
  isThemeExtensionActive: boolean;
}> => {
  //https://yespo.io/api/v1/site/webpush/script?domain=yespo-app-dev.myshopify.com
  const url = `${process.env.API_URL}/site/webpush/script?domain=${domain}`;
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

    console.log("connectWebPushScriptService", response);

    if (!response.ok) {
      throw new Error("requestScriptError");
    }

    const metafield = await createMetafield({
      shopId,
      admin,
      value: responseParse,
      key: WEB_PUSH_SCRIPT_HANDLE,
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
    console.log(error);
    throw new Error("requestScriptError");
  }
};

export default connectWebPushScriptService;
