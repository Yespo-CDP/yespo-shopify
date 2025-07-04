import checkThemeExtensionService from "~/services/check-theme-extension.server";
import getMetafield from "~/shopify/queries/get-metafield";

/**
 * Checks the status of Yespo scripts and theme extension in the Shopify store.
 *
 * This function verifies whether the theme extension is active and whether
 * the general Yespo script and web push script metafields exist.
 *
 * @param {Object} params - The parameters object.
 * @param {any} params.admin - The Shopify Admin API client instance.
 *
 * @returns {Promise<Object>} An object containing the status of the theme extension and scripts:
 *   - `isThemeExtensionActive` (boolean): Whether the theme extension is active.
 *   - `isGeneralScriptExist` (boolean): Whether the general Yespo script metafield exists.
 *   - `isWebPushScriptExist` (boolean): Whether the web push script metafield exists.
 *
 * @example
 * const status = await checkScriptConnectionService({ admin });
 * console.log(status.isThemeExtensionActive, status.isGeneralScriptExist);
 */

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
