import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";

import type { Account } from "~/@types/account";
import { getAccountInfo } from "~/api/get-account-info.server";
import {
  shopRepository,
  customerSyncLogRepository,
} from "~/repositories/repositories.server";
import { connectAccountService } from "~/services/connect-account.server";
import { disconnectAccountService } from "~/services/disconnect-account.server";
import { connectGeneralScriptService } from "~/services/connect-general-script.server";
import { connectWebPushScriptService } from "~/services/connect-webpush-script.server";
import checkMarketsService from "~/services/check-markets.server";
import checkScriptConnectionService from "~/services/check-script-connection.server";
import checkThemeExtensionService from "~/services/check-theme-extension.server";
import { authenticate } from "~/shopify.server";
import i18n from "~/i18n.server";
import { toggleWebTrackingServer } from "~/services/toggleWebTracking.server";
import { createGeneralDomain } from "~/api/create-general-domain.server";
import { enqueueDataSyncTasks } from "~/services/queue";

/**
 * Loader function for initializing data needed on the page.
 *
 * This function authenticates the admin, retrieves shop information,
 * checks whether there are too many markets, verifies script connection status,
 * and fetches account info from an external API if an API key exists.
 *
 * @param {LoaderFunctionArgs} args - The arguments containing the request.
 * @returns {Promise<{
 *   shop: Shop | null,
 *   account: Account | null,
 *   scriptConnectionStatus: any,
 *   isMarketsOverflowing: boolean,
 *   ENV: {
 *     DOCK_URL: string,
 *     PLATFORM_URL: string
 *   }
 * }>} - The data needed by the page.
 */

export const loaderHandler = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await shopRepository.getShop(session.shop);
  const customersSyncLog =
    await customerSyncLogRepository.getCustomerSyncLogByShop(session.shop);
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
    customersSyncLog,
    ENV: {
      DOCK_URL: process.env.DOCK_URL ?? "https://docs.yespo.io",
      PLATFORM_URL: process.env.PLATFORM_URL ?? "https://my.yespo.io",
    },
  };
};

/**
 * Action handler for processing form submissions related to account and script connections.
 *
 * Handles different `intent` types:
 * - "account-connection": Connects an account using the provided API key.
 * - "account-disconnection": Disconnects the currently connected account.
 * - "connection-status": Verifies the status of scripts and theme extension.
 *
 * @param {ActionFunctionArgs} args - The arguments containing the request.
 * @returns {Promise<{
 *   success: {
 *     apiKey?: boolean;
 *     connection?: {
 *       ok?: boolean;
 *       isGeneralScriptExist?: boolean;
 *       isWebPushScriptExist?: boolean;
 *       isThemeExtensionActive?: boolean;
 *     };
 *   };
 *   errors: {
 *     apiKey?: string;
 *     script?: string;
 *   };
 * }>} - The result of the action including success flags and error messages.
 */

export const actionHandler = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const t = await i18n.getFixedT(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const errors: {
    apiKey?: string;
    script?: string;
    webTracking?: string;
  } = {};
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

      await connectGeneralScriptService({
        apiKey: shop.apiKey,
        shopId: shop.shopId,
        domain: shop.domain,
        admin,
      });

      success.connection = {
        isGeneralScriptExist: true,
      };

      await connectWebPushScriptService({
        apiKey: shop.apiKey,
        shopId: shop.shopId,
        domain: shop.domain,
        admin,
      });

      success.connection = {
        isWebPushScriptExist: true,
      };

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

  if (intent === "tracking-enable") {
    try {
      const shop = await shopRepository.getShop(session.shop);
      if (!shop) {
        errors.webTracking = t("General.errors.shopNotFound");
        return { success, errors };
      }

      if (!shop.siteId && shop.apiKey) {
        const connectedData = await createGeneralDomain({
          apiKey: shop.apiKey,
          domain: shop.domain,
        });

        await shopRepository.updateShop(shop.domain, {
          siteId: connectedData.siteId,
        });
      }

      await toggleWebTrackingServer({
        shopId: shop.shopId,
        domain: shop.domain,
        enabled: true,
        admin,
      });
    } catch (error: any) {
      errors.webTracking = t("WebTrackingSection.errors.notEnabled");
      return { success, errors };
    }
  }

  if (intent === "tracking-disable") {
    try {
      const shop = await shopRepository.getShop(session.shop);
      if (!shop) {
        errors.webTracking = t("General.errors.shopNotFound");
        return { success, errors };
      }

      await toggleWebTrackingServer({
        shopId: shop.shopId,
        domain: shop.domain,
        enabled: false,
        admin,
      });
    } catch (error: any) {
      errors.webTracking = t("WebTrackingSection.errors.notDisabled");
      return { success, errors };
    }
  }

  if (intent === "contact-sync-enable") {
    try {
      const shop = await shopRepository.getShop(session.shop);
      if (!shop) {
        errors.webTracking = t("General.errors.shopNotFound");
        return { success, errors };
      }

      await shopRepository.updateShop(shop.domain, {
        isContactSyncEnabled: true,
      });

      await enqueueDataSyncTasks({ session });
    } catch (error: any) {
      errors.webTracking = t("ContactSyncSection.errors.notEnabled");
      return { success, errors };
    }
  }

  if (intent === "contact-sync-disable") {
    try {
      const shop = await shopRepository.getShop(session.shop);
      if (!shop) {
        errors.webTracking = t("General.errors.shopNotFound");
        return { success, errors };
      }

      await shopRepository.updateShop(shop.domain, {
        isContactSyncEnabled: false,
      });
    } catch (error: any) {
      errors.webTracking = t("ContactSyncSection.errors.notDisabled");
      return { success, errors };
    }
  }

  return { success, errors };
};
