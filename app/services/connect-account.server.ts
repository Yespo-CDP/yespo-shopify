import { getAccountInfo } from "~/api/get-account-info.server";
import { shopRepository } from "~/repositories/repositories.server";
import deleteMetafields from "~/shopify/mutations/delete-metafields.server";

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

export const connectAccountService = async ({
  session,
  apiKey,
  admin,
}: {
  session: any;
  apiKey: string;
  admin: any;
}) => {
  await getAccountInfo({ apiKey });
  await shopRepository.updateShop(session.shop, { apiKey });
  const shop = await shopRepository.getShop(session.shop);
  if (shop?.shopId) {
    await deleteMetafields({
      admin,
      ownerId: shop?.shopId,
      keys: [GENERAL_SCRIPT_HANDLE, WEB_PUSH_SCRIPT_HANDLE],
    });
  }
};
