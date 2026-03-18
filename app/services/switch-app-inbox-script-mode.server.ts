import getMetafield from "~/shopify/queries/get-metafield";
import createMetafield from "~/shopify/mutations/create-metafield.server";
import {getAuthCallbackScript} from "~/utils/get-auth-callback-script";

const GENERAL_SCRIPT_HANDLE =
  process.env.GENERAL_SCRIPT_HANDLE ?? "yespo-script";
const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL ?? ''

type ToggleOptions = {
  enabled: boolean;
  getAuthTokenCallback?: string;
  language?: string;
};

/**
 * Options for toggling App Inbox mode in the storefront script.
 *
 * @typedef {Object} ToggleOptions
 * @property {boolean} enabled - Whether to enable or disable App Inbox mode.
 * @property {string} [getAuthTokenCallback] - Optional auth token callback function as a string.
 * @property {string} [language] - Optional language code (default is 'en').
 */

/**
 * Updates the given script content to enable or disable Yespo App Inbox mode.
 *
 * @param {string} scriptValue - Current script content from the Shopify store.
 * @param {ToggleOptions} options - Options for toggling App Inbox mode.
 * @returns {string} The updated script content.
 *
 * @example
 * const updatedScript = toggleAppInboxScriptInit(existingScript, {
 *   enabled: true,
 *   getAuthTokenCallback: '() => yespoAppAuthCallback()',
 *   language: 'en'
 * });
 */

const toggleAppInboxScriptInit = (
  scriptValue: string,
  options: ToggleOptions
): string => {
  const {enabled, getAuthTokenCallback = '() => {}', language = 'en'} = options;

  const defaultInitRegex = /eS\(\s*['"]init['"]\s*\)/g;
  const authCallbackScript = getAuthCallbackScript(SHOPIFY_APP_URL)

  const appInboxInit = `
    ${authCallbackScript}
    eS('init', {APP_INBOX: true}, {
      getAuthTokenCallback: ${getAuthTokenCallback},
      language: ${language}
    })`;

  if (enabled) {
    // replace default init to APP Inbox mode
    return scriptValue.replace(defaultInitRegex, appInboxInit);
  }

  const appInboxRegex =
    /(?:\s*function yespoAppAuthCallback\(\)\s*\{[\s\S]*?\}\s*)?eS\(\s*['"]init['"]\s*,\s*\{APP_INBOX:\s*true\}\s*,\s*\{[\s\S]*?\}\s*\)/g;

  // replace APP Inbox mode to default init
  return scriptValue.replace(appInboxRegex, `eS('init')`);
}


/**
 * Enables or disables the Yespo App Inbox script on the Shopify storefront
 * by fetching and updating the corresponding Shopify metafield.
 *
 * @async
 * @function switchAppInboxScriptServer
 * @param {Object} params - Parameters object.
 * @param {boolean} params.enabled - Whether to enable or disable App Inbox mode.
 * @param {any} params.admin - Shopify Admin API client instance.
 * @param {string} params.shopId - The Shopify store ID.
 * @returns {Promise<void>} Resolves when the metafield is updated.
 *
 * @example
 * await switchAppInboxScriptServer({
 *   enabled: true,
 *   admin: shopifyAdminClient,
 *   shopId: '123456789'
 * });
 */

const switchAppInboxScriptServer = async ({enabled, admin, shopId}: {
  enabled: boolean,
  admin: any,
  shopId: string;
}) => {
  const metafield = await getMetafield({
    admin,
    key: GENERAL_SCRIPT_HANDLE,
  });

  const scriptValue = metafield?.value;

  const updatedScript = toggleAppInboxScriptInit(scriptValue, {
    enabled,
    getAuthTokenCallback: `() => yespoAppAuthCallback()`,
    language: `window.YESPO_APP_CONFIG?.lang_iso_code || 'en'`,
  });

  const updatedMetafield = await createMetafield({
    shopId,
    admin,
    value: updatedScript,
    key: GENERAL_SCRIPT_HANDLE,
  });

  console.log('updatedMetafield', updatedMetafield)
}

export default switchAppInboxScriptServer;
