import { shopRepository } from "~/repositories/repositories.server";
import deleteMetafields from "~/shopify/mutations/delete-metafields.server";

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
  await shopRepository.updateShop(session.shop, { apiKey: "" });
  const shop = await shopRepository.getShop(session.shop);
  if (shop?.shopId) {
    await deleteMetafields({
      admin,
      ownerId: shop?.shopId,
      keys: [GENERAL_SCRIPT_HANDLE, WEB_PUSH_SCRIPT_HANDLE],
    });
  }
};
