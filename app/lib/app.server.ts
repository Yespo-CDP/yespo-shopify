import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";

import type { Account } from "~/@types/account";
import { getAccountInfo } from "~/api/get-account-info.server";
import { shopRepository } from "~/repositories/repositories.server";
import { connectAccountService } from "~/services/connect-account.server";
import { disconnectAccountService } from "~/services/disconnect-account.server";
import { connectGeneralScriptService } from "~/services/connect-general-script.server";
import { connectWebPushScriptService } from "~/services/connect-webpush-script.server";
import checkMarketsService from "~/services/check-markets.server";
import checkScriptConnectionService from "~/services/check-script-connection.server";
import checkThemeExtensionService from "~/services/check-theme-extension.server";
import { authenticate } from "~/shopify.server";
import i18n from "~/i18n.server";

export const loaderHandler = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await shopRepository.getShop(session.shop);
  const isMarketsOverflowing = await checkMarketsService({ admin });
  const scriptConnectionStatus = await checkScriptConnectionService({ admin });

  let account: Account | null = null;
  if (shop?.apiKey) {
    try {
      account = await getAccountInfo({ apiKey: shop.apiKey });
    } catch (error) {
      console.error(error);
      account = null;
    }
  }

  return {
    shop,
    account,
    scriptConnectionStatus,
    isMarketsOverflowing,
  };
};

export const actionHandler = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const t = await i18n.getFixedT(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const errors: { apiKey?: string; script?: string } = {};
  const success: {
    apiKey?: boolean;
    connection?: {
      ok?: boolean;
      isGeneralScriptExist?: boolean;
      isWebPushScriptExist?: boolean;
      isThemeExtensionActive?: boolean;
    };
  } = {};

  if (intent === "account-disconnection") {
    try {
      await disconnectAccountService({ session, admin });
    } catch (error: any) {
      errors.apiKey = t(`AccountConnectionSection.errors.${error.message}`);
      return { success, errors };
    }
  }

  if (intent === "account-connection") {
    const apiKey = formData.get("apiKey")?.toString();
    if (!apiKey) {
      errors.apiKey = t("AccountConnectionSection.errors.emptyApiKey");
      return { success, errors };
    }

    try {
      await connectAccountService({ session, apiKey, admin });
      success.apiKey = true;
    } catch (error: any) {
      errors.apiKey = t(`AccountConnectionSection.errors.${error.message}`);
      return { success, errors };
    }
  }

  if (intent === "connection-status") {
    try {
      const shop = await shopRepository.getShop(session.shop);
      if (!shop || !shop?.apiKey) {
        errors.script = t("AccountConnectionSection.errors.emptyApiKey");
        return { success, errors };
      }

      try {
        await connectGeneralScriptService({
          apiKey: shop.apiKey,
          shopId: shop.shopId,
          domain: shop.domain,
          admin,
        });

        success.connection = {
          isGeneralScriptExist: true,
        };
      } catch (_) {}

      try {
        await connectWebPushScriptService({
          apiKey: shop.apiKey,
          shopId: shop.shopId,
          domain: shop.domain,
          admin,
        });

        success.connection = {
          isWebPushScriptExist: true,
        };
      } catch (_) {}

      const isThemeExtensionActive = await checkThemeExtensionService({
        admin,
      });

      success.connection = {
        ...success.connection,
        isThemeExtensionActive,
        ok: true,
      };
    } catch (error: any) {
      errors.script = t(`ConnectionStatusSection.errors.${error.message}`);
      return { success, errors };
    }
  }

  return { success, errors };
};
