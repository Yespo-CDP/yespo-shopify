import { getAccountInfo } from "~/api/get-account-info.server";
import { shopRepository } from "~/repositories/repositories.server";
import deleteMetafields from "~/shopify/mutations/delete-metafields.server";
import {sendLogEvent} from "~/api/send-log-event";
import {EVENT_MESSAGES} from "~/config/constants";

/**
 * Connects an account by verifying the API key, updating the shop record,
 * and deleting existing Yespo-related metafields from the Shopify store.
 *
 * @param {Object} params - The parameters object.
 * @param {any} params.session - The current session object containing shop info.
 * @param {string} params.apiKey - The API key to connect with the account.
 * @param {any} params.admin - Shopify Admin API client instance.
 *
 * @returns {Promise<void>} Resolves when the account connection process completes.
 *
 * @throws Will throw an error if `getAccountInfo` fails (e.g., invalid API key).
 *
 * @example
 * await connectAccountService({ session, apiKey, admin });
 */

const GENERAL_SCRIPT_HANDLE =
  process.env.GENERAL_SCRIPT_HANDLE ?? "yespo-script";
const WEB_PUSH_SCRIPT_HANDLE =
  process.env.WEB_PUSH_SCRIPT_HANDLE ?? "yespo-web-push-script";
const HOST_URL =
  process.env.HOST_URL ?? "yespo-app-host";

export const connectAccountService = async ({
  session,
  apiKey,
  admin,
  orgId
}: {
  session: any;
  apiKey: string;
  admin: any;
  orgId?: number | null;
}) => {
  const accountInfo = await getAccountInfo({ apiKey, domain: session.shop });
  await shopRepository.updateShop(session.shop, { apiKey, orgId: accountInfo.orgId });
  const shop = await shopRepository.getShop(session.shop);
  if (shop?.shopId) {
    await deleteMetafields({
      admin,
      ownerId: shop?.shopId,
      keys: [GENERAL_SCRIPT_HANDLE, WEB_PUSH_SCRIPT_HANDLE, HOST_URL],
    });
  }

  if (!shop || !shop.apiKey) {
    await sendLogEvent({
      orgId: accountInfo.orgId,
      errorMessage: 'API key is empty',
      data: {domain: session.shop},
      message: EVENT_MESSAGES.ADD_API_KEY_FAILED,
      logLevel: 'ERROR'
    })
  } else {
    await sendLogEvent({
      orgId: accountInfo.orgId,
      errorMessage: '',
      data: {domain: session.shop},
      message: EVENT_MESSAGES.ADD_API_KEY_SUCCESS,
      logLevel: 'INFO'
    })
  }
};
