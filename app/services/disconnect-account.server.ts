import { shopRepository } from "~/repositories/repositories.server";
import deleteMetafields from "~/shopify/mutations/delete-metafields.server";

/**
 * Disconnects a Yespo account by clearing the stored API key and deleting associated metafields.
 *
 * This function updates the shop's record to remove the Yespo API key, effectively disabling the connection, remove siteId
 * and then deletes the general and web push script metafields from the Shopify store.
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
    siteId: ""
  });
  const shop = await shopRepository.getShop(session.shop);
  if (shop?.shopId) {
    await deleteMetafields({
      admin,
      ownerId: shop?.shopId,
      keys: [GENERAL_SCRIPT_HANDLE, WEB_PUSH_SCRIPT_HANDLE],
    });
  }
};
