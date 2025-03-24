import checkThemeExtensionService from "~/services/check-theme-extension.server";
import getMetafield from "~/shopify/queries/get-metafield";

const GENERAL_SCRIPT_HANDLE =
  process.env.GENERAL_SCRIPT_HANDLE ?? "yespo-script";
const WEB_PUSH_SCRIPT_HANDLE =
  process.env.WEB_PUSH_SCRIPT_HANDLE ?? "yespo-web-push-script";

const checkScriptConnectionService = async ({
  admin,
}: {
  admin: any;
}): Promise<{
  isThemeExtensionActive: boolean;
  isGeneralScriptExist: boolean;
  isWebPushScriptExist: boolean;
}> => {
  const isThemeExtensionActive = await checkThemeExtensionService({ admin });
  const metafield = await getMetafield({
    admin,
    key: GENERAL_SCRIPT_HANDLE,
  });

  const webPushMetafield = await getMetafield({
    admin,
    key: WEB_PUSH_SCRIPT_HANDLE,
  });

  const isGeneralScriptExist = !!metafield?.value;
  const isWebPushScriptExist = !!webPushMetafield?.value;

  return {
    isThemeExtensionActive,
    isGeneralScriptExist,
    isWebPushScriptExist,
  };
};

export default checkScriptConnectionService;
