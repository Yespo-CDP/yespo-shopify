import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";

import type { Account } from "~/@types/account";
import { shopRepository } from "~/repositories/repositories.server";
import getAccountInfoService from "~/services/get-account-info.server";
import createDomain from "~/services/domain.server";
import createWebPushDomain from "~/services/webpush-domain.server";
import connectScriptService from "~/services/connect-script.server";
import connectWebPushScriptService from "~/services/connect-webpush-script.server";
import checkMarketsService from "~/services/check-markets.server";
import checkScriptConnectionService from "~/services/check-script-connection.server";
import deleteMetafields from "~/shopify/mutations/delete-metafields.server";
import { authenticate } from "~/shopify.server";
import i18n from "~/i18n.server";

const GENERAL_SCRIPT_HANDLE =
  process.env.GENERAL_SCRIPT_HANDLE ?? "yespo-script";
const WEB_PUSH_SCRIPT_HANDLE =
  process.env.WEB_PUSH_SCRIPT_HANDLE ?? "yespo-web-push-script";

export const loaderHandler = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await shopRepository.getShop(session.shop);
  const isMarketsOverflowing = await checkMarketsService({ admin });
  const scriptConnectionStatus = await checkScriptConnectionService({ admin });

  let account: Account | null = null;
  if (shop?.apiKey) {
    try {
      account = await getAccountInfoService({ apiKey: shop.apiKey });
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
      isScriptExist?: boolean;
      isThemeExtensionActive?: boolean;
    };
  } = {};

  if (intent === "account-connection") {
    const apiKey = formData.get("apiKey")?.toString();
    if (!apiKey) {
      errors.apiKey = t("AccountConnectionSection.errors.emptyApiKey");
      return { success, errors };
    }

    try {
      await getAccountInfoService({ apiKey });
      await shopRepository.updateShop(session.shop, { apiKey });
      const shop = await shopRepository.getShop(session.shop);
      if (shop?.shopId) {
        await deleteMetafields({
          admin,
          ownerId: shop?.shopId,
          keys: [GENERAL_SCRIPT_HANDLE, WEB_PUSH_SCRIPT_HANDLE],
        });
      }
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

      await createDomain({
        apiKey: shop.apiKey,
        domain: shop.domain,
      });

      success.connection = await connectScriptService({
        apiKey: shop.apiKey,
        shopId: shop.shopId,
        admin,
      });

      success.connection = success.connection ?? {};
      success.connection.ok = true;
    } catch (error: any) {
      errors.script = t(`ConnectionStatusSection.errors.${error.message}`);
      return { success, errors };
    }
  }

  if (intent === "web-push-connection-status") {
    try {
      const shop = await shopRepository.getShop(session.shop);
      if (!shop || !shop?.apiKey) {
        errors.script = t("AccountConnectionSection.errors.emptyApiKey");
        return { success, errors };
      }

      await createWebPushDomain({
        apiKey: shop.apiKey,
        domain: shop.domain,
      });

      success.connection = await connectWebPushScriptService({
        apiKey: shop.apiKey,
        shopId: shop.shopId,
        domain: shop.domain,
        admin,
      });

      success.connection = success.connection ?? {};
      success.connection.ok = true;
    } catch (error: any) {
      errors.script = t(`ConnectionStatusSection.errors.${error.message}`);
      return { success, errors };
    }
  }

  return { success, errors };
};
