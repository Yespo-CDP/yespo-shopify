import createMetafield from "~/shopify/mutations/create-metafield.server";
import {shopRepository} from "~/repositories/repositories.server";
import {sendLogEvent} from "~/api/send-log-event";
import {EVENT_MESSAGES} from "~/config/constants";
import getMetafield from "~/shopify/queries/get-metafield";

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
  enabled,
  orgId
}: {
  shopId: string;
  admin: any;
  domain: string;
  enabled: boolean;
  orgId?: number | null;
}): Promise<boolean> => {
  try {
    const store = await shopRepository.updateShop(domain, { isWebTrackingEnabled: enabled });

    const metafield = await createMetafield({
      shopId,
      admin,
      value: enabled ? 'true' : 'false',
      type: "boolean",
      key: WEB_TRACKING_ENABLED,
    });

    if (enabled) {
      const hostUrl = await getMetafield({
        admin,
        key: HOST_URL,
      });

      if (!hostUrl || (hostUrl && hostUrl.value !== SHOPIFY_APP_URL) ) {
        await createMetafield({
          shopId,
          admin,
          value: SHOPIFY_APP_URL,
          key: HOST_URL,
        });
      }


      await sendLogEvent({
        orgId: store?.orgId,
        errorMessage: '',
        data: {domain},
        message: EVENT_MESSAGES.WEB_TRACKING_ENABLED,
        logLevel: 'INFO'
      })

    } else {
      await sendLogEvent({
        orgId: store?.orgId,
        errorMessage: '',
        data: {domain},
        message: EVENT_MESSAGES.WEB_TRACKING_DISABLED,
        logLevel: 'INFO'
      })
    }

    if (!metafield) {
      await sendLogEvent({
        orgId: store?.orgId,
        errorMessage: 'Failed to create metafield for web tracking enabled',
        data: {domain},
        message: EVENT_MESSAGES.WEB_TRACKING_FAILED,
        logLevel: 'ERROR'
      })

      throw new Error("requestScriptError");
    }

    return true;
  } catch (error: any) {
    console.error(`Error enabling web tracking: ${error.message}`)

    await sendLogEvent({
      orgId,
      errorMessage: `Error ${enabled ? 'enabling' : 'disabling'} web tracking: ${error.message}`,
      data: {domain},
      message: EVENT_MESSAGES.WEB_TRACKING_FAILED,
      logLevel: 'ERROR'
    })

    if (error?.message) {
      throw new Error(error.message);
    } else {
      throw new Error("Error enabling web tracking");
    }
  }
}
