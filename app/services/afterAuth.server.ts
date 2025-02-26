import type { Session } from "@shopify/shopify-api";

import createMetafieldDefinition from "~/shopify/mutations/create-metafield-definition.server";
import { shopRepository } from "~/repositories/repositories.server";
import getShop from "~/shopify/queries/get-shop.server";
import shopify from "~/shopify.server";

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

  await createMetafieldDefinition({
    admin,
    key: process.env.SCRIPT_HANDLE ?? "yespo-script",
  });

  shopify.registerWebhooks({ session });
};

export default afterAuth;
