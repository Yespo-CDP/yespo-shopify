import type { ActionFunctionArgs } from "react-router";

import { shopRepository } from "~/repositories/repositories.server";
import { reconcileMarketCatalogSync } from "~/services/reconcile-market-catalog-sync";
import { countEnabledMarkets } from "~/services/sync-market-tracking-metafield.server";
import { reconcileMarketWebPushScripts } from "~/services/sync-market-web-push-scripts.server";
import { enqueueMarketSyncTaskForShopUrl } from "~/services/queue";

import { authenticate } from "../shopify.server";

const MARKET_WEBHOOK_TOPICS = new Set([
  "MARKETS_CREATE",
  "MARKETS_UPDATE",
  "MARKETS_DELETE",
]);

/**
 * Handles Shopify market webhooks.
 *
 * Re-reads enabled market root URLs and adds any new host to the
 * multi-domain web push metafield. Stored domains stay when a market
 * is no longer enabled.
 *
 * When product sync is on and a market is added or enabled, queues a
 * shop-wide market catalog sync for every enabled market. Dropping back
 * to a single market queues that job once more so removed countries are
 * cleared, then turns market sync off.
 *
 * Returns 500 so Shopify retries when a new host cannot be registered or
 * the catalog sync job cannot be queued yet.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (!session || !admin) {
    return new Response();
  }

  if (!MARKET_WEBHOOK_TOPICS.has(topic)) {
    console.warn(`Unhandled webhook topic: ${topic}`);
    return new Response();
  }

  const shopRecord = await shopRepository.getShop(shop);
  if (!shopRecord?.apiKey || !shopRecord.shopId) {
    return new Response();
  }

  try {
    const result = await reconcileMarketWebPushScripts({
      admin,
      apiKey: shopRecord.apiKey,
      shopId: shopRecord.shopId,
      domain: shopRecord.domain || shopRecord.shopUrl,
      orgId: shopRecord.orgId,
      webPushInstalled: Boolean(shopRecord.isWebPushScriptInstalled),
    });

    if (result.changed) {
      console.log(
        `[${topic}] ${shop} added ${result.added.join(", ") || "none"}`,
      );
    }

    if (shopRecord.isProductVariantSyncEnabled) {
      const enabledMarketCount = await countEnabledMarkets(admin);
      await reconcileMarketCatalogSync({
        shop: {
          isProductVariantSyncEnabled: true,
          isMarketSyncEnabled: Boolean(shopRecord.isMarketSyncEnabled),
        },
        enabledMarketCount,
        updateMarketSyncEnabled: async (enabled) => {
          await shopRepository.updateShop(shopRecord.shopUrl, {
            isMarketSyncEnabled: enabled,
          });
        },
        enqueueMarketSync: async () =>
          (await enqueueMarketSyncTaskForShopUrl(shopRecord.shopUrl)) > 0,
      });
    }
  } catch (error) {
    console.error(`[${topic}]`, error);
    return new Response("Failed to update market storefront settings", {
      status: 500,
    });
  }

  return new Response();
};
