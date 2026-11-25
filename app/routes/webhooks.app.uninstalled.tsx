import type { ActionFunctionArgs } from "react-router";

import { shopRepository } from "~/repositories/repositories.server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {deleteAccessTokenService} from "~/services/delete-access-token.server";

/**
 * Action handler for Shopify webhook events related to app uninstallation or deactivation.
 *
 * Authenticates the webhook request and logs the received topic and shop.
 * If the shop exists, revokes its Yespo access token, then in one transaction
 * marks the shop inactive, clears its Yespo key, sync flags and stored product
 * language, frees its primary domain (sets `domain` to the shop's own myshopify URL), and deletes
 * local customer, order, product, and market sync rows. Sessions are deleted
 * last, so a failed cleanup is retried by Shopify. The Yespo catalog is left as-is.
 *
 * Note: Webhook events can be triggered multiple times or after the app
 * has been uninstalled, so the cleanup does not depend on the session.
 *
 * @param {ActionFunctionArgs} args - The arguments containing the request.
 * @returns {Promise<Response>} An empty HTTP response indicating success.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const store = await shopRepository.getShop(shop);

  //Delete access token from Yespo
  if (store?.apiKey) {
    await deleteAccessTokenService({apiKey: store.apiKey, domain: store.domain || shop, orgId: store.orgId})
  }

  if (store) {
    const where = { shopId: store.id };
    await db.$transaction([
      db.shop.update({
        where: { id: store.id },
        data: {
          apiKey: null,
          apiKeyIv: null,
          apiKeyAuthTag: null,
          active: false,
          isWebTrackingEnabled: false,
          isContactSyncEnabled: false,
          isOrderSyncEnabled: false,
          isProductVariantSyncEnabled: false,
          isMarketSyncEnabled: false,
          siteId: null,
          orgId: null,
          defaultLanguageCode: null,
          domain: shop,
        },
      }),
      db.customerSync.deleteMany({ where }),
      db.customerSyncLog.deleteMany({ where }),
      db.orderSync.deleteMany({ where }),
      db.orderSyncLog.deleteMany({ where }),
      db.productVariantSync.deleteMany({ where }),
      db.productVariantSyncLog.deleteMany({ where }),
      db.marketSync.deleteMany({ where }),
      db.marketSyncLog.deleteMany({ where }),
      db.shopMarket.deleteMany({ where }),
      db.tmpMarketSync.deleteMany({ where }),
    ]);
  }

  // Sessions go last: if the cleanup above fails, Shopify retries the webhook.
  await db.session.deleteMany({ where: { shop } });

  return new Response();
};
