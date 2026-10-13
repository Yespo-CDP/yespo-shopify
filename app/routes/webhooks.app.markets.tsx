import type { ActionFunctionArgs } from "react-router";

import { shopRepository } from "~/repositories/repositories.server";
import { shouldTrackMarketId } from "~/services/market-tracking";
import {
  countEnabledMarkets,
  setMarketTrackingMetafield,
} from "~/services/sync-market-tracking-metafield.server";
import { reconcileMarketWebPushScripts } from "~/services/sync-market-web-push-scripts.server";

import { authenticate } from "../shopify.server";

const MARKET_WEBHOOK_TOPICS = new Set([
  "MARKETS_CREATE",
  "MARKETS_UPDATE",
  "MARKETS_DELETE",
]);

/**
 * Handles Shopify market webhooks.
 *
 * Re-reads enabled market root URLs and updates the multi-domain web push
 * metafield when the storefront host set no longer matches it.
 * Also refreshes market-tracking-enabled from the current market count.
 * Returns 500 so Shopify retries when a new host cannot be registered.
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
        `[${topic}] ${shop} added ${result.added.join(", ") || "none"}, removed ${result.removed.join(", ") || "none"}`,
      );
    }

    const enabledMarketCount = await countEnabledMarkets(admin);
    const trackingUpdated = await setMarketTrackingMetafield({
      admin,
      shopId: shopRecord.shopId,
      enabled: shouldTrackMarketId(
        shopRecord.isMarketSyncEnabled,
        enabledMarketCount,
      ),
    });
    if (!trackingUpdated) {
      throw new Error("Failed to update market tracking metafield");
    }
  } catch (error) {
    console.error(`[${topic}]`, error);
    return new Response("Failed to update market storefront settings", {
      status: 500,
    });
  }

  return new Response();
};
