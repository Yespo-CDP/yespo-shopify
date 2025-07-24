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
const WEB_TRACKING_ENABLED =
  process.env.WEB_TRACKING_ENABLED ?? "web-tracking-enabled";
const HOST_URL =
  process.env.HOST_URL ?? "yespo-app-host";

/**
 * Handles post-authentication logic for a Shopify session.
 *
 * - Updates or creates the shop in your database
 * - Registers metafield definitions for Yespo scripts if they do not exist
 * - Deletes Yespo-related metafields if the shop has no API key
 * - Registers webhooks
 *
 * @function afterAuth
 * @param {Object} params - Parameters object
 * @param {Session} params.session - Shopify session object
 * @param {any} params.admin - Shopify admin API client
 * @returns {Promise<void>} Resolves when setup is complete
 *
 * @throws {Error} If the shop could not be retrieved
 */
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

  const webTrackingDefinition = await getMetafieldDefinition({
    admin,
    key: WEB_TRACKING_ENABLED,
  });

  const hostDefinition = await getMetafieldDefinition({
    admin,
    key: HOST_URL,
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

  if (!webTrackingDefinition) {
    await createMetafieldDefinition({
      admin,
      key: WEB_TRACKING_ENABLED,
      name: "Web tracking enabled",
      type: "boolean",
      description:
        "This is a app metafield definition for Yespo web tracking capability",
    });
  }

  if (!hostDefinition) {
    await createMetafieldDefinition({
      admin,
      key: HOST_URL,
      name: "Yespo app host",
      description:
        "This is a app metafield definition for Yespo app host",
    });
  }

  if (!shopObject?.apiKey && shop?.id) {
    await deleteMetafields({
      admin,
      ownerId: shop?.id,
      keys: [GENERAL_SCRIPT_HANDLE, WEB_PUSH_SCRIPT_HANDLE, WEB_TRACKING_ENABLED, HOST_URL],
    });
  }

  shopify.registerWebhooks({ session });
};

export default afterAuth;
