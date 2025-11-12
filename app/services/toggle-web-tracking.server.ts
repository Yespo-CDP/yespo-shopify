import createMetafield from "~/shopify/mutations/create-metafield.server";
import {shopRepository} from "~/repositories/repositories.server";
import deleteMetafields from "~/shopify/mutations/delete-metafields.server";

const WEB_TRACKING_ENABLED =
  process.env.WEB_TRACKING_ENABLED ?? "web-tracking-enabled";
const HOST_URL =
  process.env.HOST_URL ?? "yespo-app-host";
const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL ?? ''

/**
 * Enables or disables web tracking for a given shop by updating the shop record
 * and setting the corresponding metafield in Shopify.
 *
 * @async
 * @function toggleWebTrackingServer
 * @param {Object} params - The parameters object.
 * @param {string} params.shopId - The unique identifier of the shop.
 * @param {any} params.admin - The Shopify Admin API client instance.
 * @param {string} params.domain - The domain of the shop.
 * @param {boolean} params.enabled - Flag to enable (`true`) or disable (`false`) web tracking.
 * @returns {Promise<boolean>} Resolves to `true` if the operation succeeds.
 *
 * @throws {Error} Throws an error if updating the shop or creating the metafield fails.
 *
 * @example
 * await toggleWebTrackingServer({
 *   shopId: "123456",
 *   admin,
 *   domain: "example.myshopify.com",
 *   enabled: true,
 * });
 */
export const toggleWebTrackingServer = async ({
  shopId,
  admin,
  domain,
  enabled
}: {
  shopId: string;
  admin: any;
  domain: string;
  enabled: boolean;
}): Promise<boolean> => {
  try {
    console.log('domain', domain)
    console.log('enabled', enabled)
    console.log('shopId', shopId)
    await shopRepository.updateShop(domain, { isWebTrackingEnabled: enabled });

    const metafield = await createMetafield({
      shopId,
      admin,
      value: enabled ? 'true' : 'false',
      type: "boolean",
      key: WEB_TRACKING_ENABLED,
    });

    if (enabled) {
      await createMetafield({
        shopId,
        admin,
        value: SHOPIFY_APP_URL,
        key: HOST_URL,
      });
    } else {
      await deleteMetafields({
        admin,
        ownerId: shopId,
        keys: [HOST_URL],
      });
    }

    if (!metafield) {
      throw new Error("requestScriptError");
    }

    return true;
  } catch (error: any) {
    console.error(`Error enabling web tracking: ${error.message}`)
    if (error?.message) {
      throw new Error(error.message);
    } else {
      throw new Error("Error enabling web tracking");
    }
  }
}
