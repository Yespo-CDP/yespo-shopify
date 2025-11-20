import type { ActionFunctionArgs } from "react-router";

import { shopRepository } from "~/repositories/repositories.server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {deleteAccessTokenService} from "~/services/delete-access-token.server";

/**
 * Action handler for Shopify webhook events related to app uninstallation or deactivation.
 *
 * Authenticates the webhook request and logs the received topic and shop.
 * If a valid session exists, updates the shop record to mark it inactive and
 * removes all related sessions from the database.
 *
 * Note: Webhook events can be triggered multiple times or after the app
 * has been uninstalled, so the session may not exist.
 *
 * @param {ActionFunctionArgs} args - The arguments containing the request.
 * @returns {Promise<Response>} An empty HTTP response indicating success.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    const store = await shopRepository.getShop(session.shop);

    //Delete access token from Yespo
    if (store?.apiKey) {
      await deleteAccessTokenService({apiKey: store.apiKey})
    }

    const shopData = await shopRepository.updateShop(shop, {
      apiKey: null,
      active: false,
      isWebTrackingEnabled: false,
      isContactSyncEnabled: false,
      isOrderSyncEnabled: false,
      siteId: null,
    });
    await db.session.deleteMany({ where: { shop } });

    if (shopData?.id) {
      await db.customerSync.deleteMany({ where: { shopId: shopData?.id } });
      await db.customerSyncLog.deleteMany({ where: { shopId: shopData?.id } });
      await db.orderSync.deleteMany({ where: { shopId: shopData?.id } });
      await db.orderSyncLog.deleteMany({ where: { shopId: shopData?.id } });
    }
  }

  return new Response();
};
