import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";

import { shopRepository } from "~/repositories/repositories.server";
import getAccountInfo from "~/services/account.service";
import getMarkets from "~/services/markets.server";
import getScript from "~/services/script.service";
import createDomain from "~/services/domain.service";
import { authenticate } from "~/shopify.server";
import i18n from "~/i18n.server";

export const loaderHandler = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const markets = await getMarkets({ admin, count: 200 });
  const shop = await shopRepository.getShop(session.shop);
  const activeMarkets = markets.filter((market) => market.enabled);
  return { shop, isMarketsOverflowing: activeMarkets?.length > 1 };
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
      await getAccountInfo({ apiKey });
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
