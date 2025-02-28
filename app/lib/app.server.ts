import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";

import { shopRepository } from "~/repositories/repositories.server";
import getAccountInfoService from "~/services/get-account-info.server";
import createDomain from "~/services/domain.server";
import connectScriptService from "~/services/connect-script.server";
import checkMarketsService from "~/services/check-markets.server";
import checkScriptConnectionService from "~/services/check-script-connection.server";
import { authenticate } from "~/shopify.server";
import i18n from "~/i18n.server";
import getMetafield from "~/shopify/queries/get-metafield";
import deleteMetafield from "~/shopify/mutations/delete-metafield.server";

export const loaderHandler = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await shopRepository.getShop(session.shop);
  const isMarketsOverflowing = await checkMarketsService({ admin });
  const scriptConnectionStatus = await checkScriptConnectionService({ admin });
  await getMetafield({
    admin,
    key: process.env.SCRIPT_HANDLE ?? "yespo-script",
  });

  return {
    shop,
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
        await deleteMetafield({
          admin,
          ownerId: shop?.shopId,
          key: process.env.SCRIPT_HANDLE ?? "yespo-script",
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

  return { success, errors };
};
