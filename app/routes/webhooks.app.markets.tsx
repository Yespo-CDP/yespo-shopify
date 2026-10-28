import type { ActionFunctionArgs } from "react-router";

import { shopRepository } from "~/repositories/repositories.server";
import {
  isActiveMarketStatus,
  marketGidFromWebhook,
} from "~/services/market-webhook-payload";
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
 * When product sync is on and the shop has at least one enabled market,
 * queues a shop-wide catalog sync the first time. A later markets/create or
 * markets/update, while sync is already on, queues a sync of only that
 * market. Dropping to zero enabled markets queues a full job once more so
 * removed countries are cleared, then turns market sync off.
 *
 * Returns 500 so Shopify retries when a new host cannot be registered or
 * the catalog sync job cannot be queued yet.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } =
    await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`, summarizeMarketWebhook(payload));

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
      const syncAlreadyOn = Boolean(shopRecord.isMarketSyncEnabled);
      const webhookMarketId =
        topic === "MARKETS_CREATE" || topic === "MARKETS_UPDATE"
          ? marketGidFromWebhook(payload)
          : null;
      // A draft market is not in the enabled set. Skip it instead of
      // syncing a market that has no catalog yet. Activating it later
      // sends markets/update and syncs that market.
      const skipDraftCreate =
        topic === "MARKETS_CREATE" &&
        syncAlreadyOn &&
        !isActiveMarketStatus(payload);

      if (!skipDraftCreate) {
        const enabledMarketCount = await countEnabledMarkets(admin);
        await reconcileMarketCatalogSync({
          shop: {
            isProductVariantSyncEnabled: true,
            isMarketSyncEnabled: syncAlreadyOn,
          },
          enabledMarketCount,
          marketId: syncAlreadyOn ? webhookMarketId : null,
          updateMarketSyncEnabled: async (enabled) => {
            await shopRepository.updateShop(shopRecord.shopUrl, {
              isMarketSyncEnabled: enabled,
            });
          },
          enqueueMarketSync: async (scope) =>
            (await enqueueMarketSyncTaskForShopUrl(
              shopRecord.shopUrl,
              scope?.marketId ? { marketId: scope.marketId } : undefined,
            )) > 0,
        });
      }
    }
  } catch (error) {
    console.error(`[${topic}]`, error);
    return new Response("Failed to update market storefront settings", {
      status: 500,
    });
  }

  return new Response();
};

/**
 * Fields we need when checking whether a country move emits one webhook
 * or one per affected market. Regions are usually absent from this payload.
 */
function summarizeMarketWebhook(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") {
    return { payload: payload ?? null };
  }
  const record = payload as Record<string, unknown>;
  return {
    id: record.id ?? null,
    adminGraphqlApiId: record.admin_graphql_api_id ?? null,
    name: record.name ?? null,
    handle: record.handle ?? null,
    status: record.status ?? null,
    keys: Object.keys(record).sort(),
  };
}
