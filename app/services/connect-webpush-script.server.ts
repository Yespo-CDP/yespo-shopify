import { getWebpushScript } from "~/api/get-webpush-script.server";
import { createWebPushDomain } from "~/api/create-webpush-domain.server";
import createMetafield from "~/shopify/mutations/create-metafield.server";

/**
 * Connects the web push script to a Shopify store by creating a web push domain,
 * retrieving the web push script, and storing it as a metafield on the shop.
 *
 * @param {Object} params - Parameters for connecting the web push script.
 * @param {string} params.shopId - The ID of the Shopify store.
 * @param {string} params.apiKey - The API key used for authentication.
 * @param {string} params.domain - The domain of the Shopify store.
 * @param {any} params.admin - Shopify Admin API client instance.
 *
 * @returns {Promise<boolean>} Returns `true` if the web push script was successfully connected.
 *
 * @throws Will throw an error if the web push domain creation, script retrieval,
 * or metafield creation fails.
 *
 * @example
 * await connectWebPushScriptService({
 *   shopId: "gid://shopify/Shop/123456",
 *   apiKey: "your-api-key",
 *   domain: "your-shop-domain.myshopify.com",
 *   admin,
 * });
 */

const WEB_PUSH_SCRIPT_HANDLE =
  process.env.WEB_PUSH_SCRIPT_HANDLE ?? "yespo-web-push-script";

export const connectWebPushScriptService = async ({
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
    await createWebPushDomain({ apiKey, domain });

    const script = await getWebpushScript({ apiKey, domain });

    const metafield = await createMetafield({
      shopId,
      admin,
      value: script,
      key: WEB_PUSH_SCRIPT_HANDLE,
    });

    if (!metafield) {
      console.error(`Metafield for web push script not created`);
      return false
    }

    return true;
  } catch (error: any) {
    console.error(`Error connecting webpush script: ${error.message}`);
    return false
  }
};
