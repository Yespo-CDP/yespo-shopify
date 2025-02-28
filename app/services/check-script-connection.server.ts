import checkThemeExtensionService from "~/services/check-theme-extension.server";
import getMetafield from "~/shopify/queries/get-metafield";

const checkScriptConnectionService = async ({
  admin,
}: {
  admin: any;
}): Promise<{
  isThemeExtensionActive: boolean;
  isScriptExist: boolean;
  isActive: boolean;
}> => {
  const isThemeExtensionActive = await checkThemeExtensionService({ admin });
  const metafield = await getMetafield({ admin, key: process.env.SCRIPT_HANDLE ?? "yespo-script" });
  const isScriptExist = !!metafield?.value;

  return {
    isThemeExtensionActive,
    isScriptExist,
    isActive: isThemeExtensionActive && isScriptExist,
  };
};

export default checkScriptConnectionService;
