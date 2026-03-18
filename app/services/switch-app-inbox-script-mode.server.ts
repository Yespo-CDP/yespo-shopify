import getMetafield from "~/shopify/queries/get-metafield";
import createMetafield from "~/shopify/mutations/create-metafield.server";

const GENERAL_SCRIPT_HANDLE =
  process.env.GENERAL_SCRIPT_HANDLE ?? "yespo-script";

type ToggleOptions = {
  enabled: boolean;
  getAuthTokenCallback?: string; // передаємо як string, бо це вставка в script
  language?: string;
};

const authCallbackScript = `function yourImplementationOfAuthCallback() {
  try {
    const customer =
      (window.YESPO_APP_CONFIG && window.YESPO_APP_CONFIG.customer) ||
      null;

    if (!customer) {
      console.log('[AuthCallback] No logged-in customer');
      return null;
    }

    console.log('CUSTOMER EXISTS');
  } catch (e) {
    console.error('[AuthCallback] Exception:', e);
    return null;
  }
}`;

const toggleAppInboxScriptInit = (
  scriptValue: string,
  options: ToggleOptions
): string => {
  const { enabled, getAuthTokenCallback = '() => {}', language = 'en' } = options;

  const defaultInitRegex = /eS\(\s*['"]init['"]\s*\)/g;

  const appInboxInit = `
${authCallbackScript}
eS('init', {APP_INBOX: true}, {
  getAuthTokenCallback: ${getAuthTokenCallback},
  language: ${language}
})`;

  if (enabled) {
    // заменяем стандартный init на APP Inbox
    return scriptValue.replace(defaultInitRegex, appInboxInit);
  }

  // если выключаем — возвращаем обычный init
  // Новая регулярка учитывает любые пробелы, переносы строк и содержимое объекта
  const appInboxRegex =
    /(?:\s*function yourImplementationOfAuthCallback\(\)\s*\{[\s\S]*?\}\s*)?eS\(\s*['"]init['"]\s*,\s*\{APP_INBOX:\s*true\}\s*,\s*\{[\s\S]*?\}\s*\)/g;

  return scriptValue.replace(appInboxRegex, `eS('init')`);
}





const switchAppInboxScriptServer = async ({enabled, admin, shopId}: { enabled: boolean, admin: any, shopId: string; }) => {
  const metafield = await getMetafield({
    admin,
    key: GENERAL_SCRIPT_HANDLE,
  });

  const scriptValue = metafield?.value;

  const updatedScript = toggleAppInboxScriptInit(scriptValue, {
    enabled,
    getAuthTokenCallback: `() => yourImplementationOfAuthCallback()`,
    language: `window.YESPO_APP_CONFIG?.lang_iso_code || 'en'`,
  });

  console.log('updatedScript',updatedScript)

  const updatedMetafield = await createMetafield({
    shopId,
    admin,
    value: updatedScript,
    key: GENERAL_SCRIPT_HANDLE,
  });

  console.log('updatedMetafield', updatedMetafield)

}

export default switchAppInboxScriptServer;
