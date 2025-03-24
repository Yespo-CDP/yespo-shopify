import type { Session } from "@shopify/shopify-api";

import createMetafieldDefinition from "~/shopify/mutations/create-metafield-definition.server";
import { shopRepository } from "~/repositories/repositories.server";
import getShop from "~/shopify/queries/get-shop.server";
import shopify from "~/shopify.server";
import getMetafieldDefinition from "~/shopify/queries/get-metafield-definition";
import deleteMetafields from "~/shopify/mutations/delete-metafields.server";

const GENERAL_SCRIPT_HANDLE =
  process.env.GENERAL_SCRIPT_HANDLE ?? "yespo-script";
const WEB_PUSH_SCRIPT_HANDLE =
  process.env.WEB_PUSH_SCRIPT_HANDLE ?? "yespo-web-push-script";

const afterAuth = async ({
  session,
  admin,
}: {
  session: Session;
  admin: any;
}): Promise<void> => {
  const shop = await getShop({ admin });

  if (!shop) {
    throw new Error("Shop not found");
  }

  const shopObject = await shopRepository.getShop(session?.shop);

  if (shopObject) {
    await shopRepository.updateShop(session.shop, {
      name: shop.name,
      email: shop.email,
      domain: shop?.primaryDomain?.host,
      active: true,
    });
  } else {
    await shopRepository.createShop({
      shopUrl: shop.myshopifyDomain,
      shopId: shop.id,
      name: shop.name,
      email: shop.email,
      domain: shop?.primaryDomain?.host,
    });
  }

  const generalDefinition = await getMetafieldDefinition({
    admin,
    key: GENERAL_SCRIPT_HANDLE,
  });

  const webPushDefinition = await getMetafieldDefinition({
    admin,
    key: WEB_PUSH_SCRIPT_HANDLE,
  });

  /* Create definition for general yespo script */
  if (!generalDefinition) {
    await createMetafieldDefinition({
      admin,
      key: GENERAL_SCRIPT_HANDLE,
      name: "Yespo script",
      description: "This is a app metafield definition for Yespo script",
    });
  }

  /* Create definition for web push yespo script */
  if (!webPushDefinition) {
    await createMetafieldDefinition({
      admin,
      key: WEB_PUSH_SCRIPT_HANDLE,
      name: "Yespo web push script",
      description:
        "This is a app metafield definition for Yespo web push script",
    });
  }

  if (!shopObject?.apiKey && shop?.id) {
    await deleteMetafields({
      admin,
      ownerId: shop?.id,
      keys: [GENERAL_SCRIPT_HANDLE, WEB_PUSH_SCRIPT_HANDLE],
    });
  }

  shopify.registerWebhooks({ session });
};

export default afterAuth;
