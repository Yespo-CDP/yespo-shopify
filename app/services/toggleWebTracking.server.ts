import createMetafield from "~/shopify/mutations/create-metafield.server";
import {shopRepository} from "~/repositories/repositories.server";

const WEB_TRACKING_ENABLED =
  process.env.WEB_TRACKING_ENABLED ?? "web-tracking-enabled";

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
}) => {
  try {
    await shopRepository.updateShop(domain, { isWebTrackingEnabled: enabled });

    const metafield = await createMetafield({
      shopId,
      admin,
      value: enabled ? 'true' : 'false',
      type: "boolean",
      key: WEB_TRACKING_ENABLED,
    });

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
