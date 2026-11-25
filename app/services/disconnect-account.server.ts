import db from "~/db.server";
import { shopRepository } from "~/repositories/repositories.server";
import deleteMetafields from "~/shopify/mutations/delete-metafields.server";

/**
 * Disconnects a Yespo account by clearing the stored API key and deleting associated metafields.
 *
 * This function updates the shop's record to remove the Yespo API key, effectively disabling the connection, remove siteId and the stored product language,
 * and then deletes the general and web push script metafields from the Shopify store.
 * It also clears the shop's local customer, order, product and market sync rows and logs, so the next account gets a full import.
 *
 * @param {Object} params - The parameters object.
 * @param {Object} params.session - The session object containing the shop identifier.
 * @param {any} params.admin - The Shopify Admin API client instance.
 *
 * @returns {Promise<void>} Resolves when the disconnection process completes.
 *
 * @throws Will throw an error if updating the shop or deleting metafields fails.
 *
 * @example
 * await disconnectAccountService({ session, admin });
 */

const GENERAL_SCRIPT_HANDLE =
  process.env.GENERAL_SCRIPT_HANDLE ?? "yespo-script";
const WEB_PUSH_SCRIPT_HANDLE =
  process.env.WEB_PUSH_SCRIPT_HANDLE ?? "yespo-web-push-script";
const WEB_PUSH_MULTI_DOMAIN_HANDLE =
  process.env.WEB_PUSH_MULTI_DOMAIN_HANDLE ?? "yespo-web-push-multi-domain";
const HOST_URL = process.env.HOST_URL ?? "yespo-app-host";
const MARKET_TRACKING_ENABLED =
  process.env.MARKET_TRACKING_ENABLED ?? "market-tracking-enabled";

export const disconnectAccountService = async ({
  session,
  admin,
}: {
  session: any;
  admin: any;
}) => {
  await shopRepository.updateShop(session.shop, {
    apiKey: "",
    isWebTrackingEnabled: false,
    isContactSyncEnabled: false,
    isOrderSyncEnabled: false,
    isProductVariantSyncEnabled: false,
    isMarketSyncEnabled: false,
    siteId: "",
    isGeneralScriptInstalled: false,
    isWebPushScriptInstalled: false,
    isAppInboxEnabled: false,
    orgId: null,
    defaultLanguageCode: null,
  });
  const shop = await shopRepository.getShop(session.shop);
  if (shop) {
    const where = { shopId: shop.id };
    await db.customerSync.deleteMany({ where });
    await db.customerSyncLog.deleteMany({ where });
    await db.orderSync.deleteMany({ where });
    await db.orderSyncLog.deleteMany({ where });
    await db.productVariantSync.deleteMany({ where });
    await db.productVariantSyncLog.deleteMany({ where });
    await db.marketSync.deleteMany({ where });
    await db.marketSyncLog.deleteMany({ where });
  }
  if (shop?.shopId) {
    await deleteMetafields({
      admin,
      ownerId: shop?.shopId,
      keys: [
        GENERAL_SCRIPT_HANDLE,
        WEB_PUSH_SCRIPT_HANDLE,
        WEB_PUSH_MULTI_DOMAIN_HANDLE,
        MARKET_TRACKING_ENABLED,
        HOST_URL,
      ],
    });
  }
};
