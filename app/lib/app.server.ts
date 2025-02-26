import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";

import { shopRepository } from "~/repositories/repositories.server";
import getAccountInfoService from "~/services/get-account-info.server";
import getScript from "~/services/script.server";
import createDomain from "~/services/domain.server";
import checkThemeExtensionService from "~/services/check-theme-extension.server";
import checkMarketsService from "~/services/check-markets.server";
import { authenticate } from "~/shopify.server";
import i18n from "~/i18n.server";

export const loaderHandler = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await shopRepository.getShop(session.shop);
  const isMarketsOverflowing = await checkMarketsService({ admin });
  const themeExtensionStatus = await checkThemeExtensionService({ admin });

  return {
    shop,
    themeExtensionStatus,
    isMarketsOverflowing,
  };
};

export const actionHandler = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const t = await i18n.getFixedT(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const errors: { apiKey?: string; script?: string } = {};
  const success: { apiKey?: boolean; script?: boolean } = {};

  if (intent === "account-connection") {
    const apiKey = formData.get("apiKey")?.toString();
    if (!apiKey) {
      errors.apiKey = t("AccountConnectionSection.errors.emptyApiKey");
      return { success, errors };
    }

    try {
      await getAccountInfoService({ apiKey });
      await shopRepository.updateShop(session.shop, { apiKey });
      success.apiKey = true;
    } catch (error: any) {
      errors.apiKey = t(`AccountConnectionSection.errors.${error.message}`);
      return { success, errors };
    }
  }

  if (intent === "connection-status") {
    const status = formData.get("connectionStatus")?.toString();
    if (status !== "true" && status !== "false") {
      errors.script = t("ConnectionStatusSection.errors.emptyConnectionStatus");
      return { success, errors };
    }

    try {
      const shop = await shopRepository.getShop(session.shop);
      if (!shop || !shop?.apiKey) {
        errors.script = t("AccountConnectionSection.errors.emptyApiKey");
        return { success, errors };
      }

      if (status === "true") {
        await createDomain({
          apiKey: shop.apiKey,
          domain: shop.domain,
        });

        await getScript({
          apiKey: shop.apiKey,
          shopId: shop.shopId,
          admin,
        });
      }

      await shopRepository.updateShop(session.shop, {
        isScriptActive: status === "true",
      });

      success.script = true;
    } catch (error: any) {
      errors.script = t(`ConnectionStatusSection.errors.${error.message}`);
      return { success, errors };
    }
  }

  return { success, errors };
};
