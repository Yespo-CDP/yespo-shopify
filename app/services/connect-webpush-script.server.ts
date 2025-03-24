import { getWebpushScript } from "~/api/get-webpush-script.server";
import { createWebPushDomain } from "~/api/create-webpush-domain.server";
import createMetafield from "~/shopify/mutations/create-metafield.server";

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
      throw new Error("requestScriptError");
    }

    return true;
  } catch (error: any) {
    throw new Error("requestScriptError");
  }
};
