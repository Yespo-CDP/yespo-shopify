import type { Session } from "@shopify/shopify-api";

import type { ShopDataResponse } from "~/@types/shop";
import createDefinition from "~/helpers/create-definition";
import { shopRepository } from "~/repositories/repositories.server";
import shopify from "~/shopify.server";

const afterAuth = async ({
  session,
  admin,
}: {
  session: Session;
  admin: any;
}): Promise<void> => {
  const response = await admin.graphql(`
    #graphql
    query {
      shop {
        id
        myshopifyDomain
        contactEmail
        email
        name
        url
        primaryDomain {
          id
          host
        }
      }
    }
  `);

  const responseParse = await response.json();
  const shopData = responseParse?.data as ShopDataResponse;
  const shop = shopData?.shop;

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

  await createDefinition({
    admin,
    key: process.env.METAFIELD_KEY ?? "pixel-script",
  });

  shopify.registerWebhooks({ session });
};

export default afterAuth;
