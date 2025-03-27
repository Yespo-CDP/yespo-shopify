import { getGeneralScript } from "~/api/get-general-script.server";
import { createGeneralDomain } from "~/api/create-general-domain.server";
import createMetafield from "~/shopify/mutations/create-metafield.server";

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
