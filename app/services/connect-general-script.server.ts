import { getGeneralScript } from "~/api/get-general-script.server";
import { createGeneralDomain } from "~/api/create-general-domain.server";
import createMetafield from "~/shopify/mutations/create-metafield.server";

/**
 * Connects the general Yespo script to a Shopify store by creating a domain,
 * fetching the script content, and storing it as a metafield on the shop.
 *
 * @param {Object} params - Parameters for connecting the general script.
 * @param {string} params.shopId - The ID of the Shopify store.
 * @param {string} params.apiKey - The API key used for authentication.
 * @param {string} params.domain - The domain of the Shopify store.
 * @param {any} params.admin - Shopify Admin API client instance.
 *
 * @returns {Promise<boolean>} Returns `true` if the script was successfully connected.
 *
 * @throws Throws an error if the script cannot be fetched or the metafield cannot be created.
 *
 * @example
 * await connectGeneralScriptService({
 *   shopId: "gid://shopify/Shop/123456",
 *   apiKey: "your-api-key",
 *   domain: "your-shop-domain.myshopify.com",
 *   admin,
 * });
 */

const GENERAL_SCRIPT_HANDLE =
  process.env.GENERAL_SCRIPT_HANDLE ?? "yespo-script";

export const connectGeneralScriptService = async ({
  shopId,
  apiKey,
  domain,
  admin,
}: {
  shopId: string;
  apiKey: string;
  domain: string;
  admin: any;
}) => {
  try {
    await createGeneralDomain({ apiKey, domain });

    const script = await getGeneralScript({ apiKey });

    const metafield = await createMetafield({
      shopId,
      admin,
      value: script,
      key: GENERAL_SCRIPT_HANDLE,
    });

    if (!metafield) {
      throw new Error("requestScriptError");
    }

    return true;
  } catch (error: any) {
    console.error(`Error connecting general script: ${error.message}`);
    if (error?.message) {
      throw new Error(error.message);
    } else {
      throw new Error("requestScriptError");
    }
  }
};
