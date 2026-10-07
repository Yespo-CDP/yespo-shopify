import type { Session } from "@shopify/shopify-app-react-router/server";

import { sendLogEvent } from "~/api/send-log-event";
import { EVENT_MESSAGES } from "~/config/constants";
import {
  productVariantSyncLogRepository,
  shopRepository,
} from "~/repositories/repositories.server";
import { enqueueDataSyncTasks } from "~/services/queue";
import { hasProductSyncScopes } from "~/services/product-sync-scopes";

export type ProductSyncRolloutResult = "enabled" | "skipped" | "failed";

/**
 * Enables product sync once for a shop stamped by the rollout migration.
 *
 * No-ops until the product scopes are granted and the shop still has
 * `productSyncAutoEnable`. A conditional claim keeps the webhook and the
 * page loader from enqueueing the historical sync twice.
 */
export async function enableProductSyncForRollout({
  shopUrl,
  scopes,
}: {
  shopUrl: string;
  scopes: string | string[] | null | undefined;
}): Promise<ProductSyncRolloutResult> {
  if (!hasProductSyncScopes(scopes)) {
    return "skipped";
  }

  const shop = await shopRepository.getShop(shopUrl);
  if (!shop?.productSyncAutoEnable || shop.active !== true || !shop.apiKey) {
    return "skipped";
  }

  const claimed = await shopRepository.claimProductSyncRollout(shop.shopUrl);
  if (!claimed) {
    return "skipped";
  }

  const logDomain = shop.domain || shop.shopUrl;

  try {
    await productVariantSyncLogRepository.createOrUpdateProductVariantSyncLog(
      {
        status: "NOT_STARTED",
        skippedCount: 0,
        syncedCount: 0,
        failedCount: 0,
        totalCount: 0,
        shop: {
          connect: {
            id: shop.id,
          },
        },
      },
    );

    await enqueueDataSyncTasks({
      session: { shop: shop.shopUrl } as Session,
      shop,
      kinds: ["product"],
    });
  } catch (error: any) {
    await shopRepository.releaseProductSyncRollout(
      shop.shopUrl,
      Boolean(shop.isMarketSyncEnabled),
    );

    try {
      await productVariantSyncLogRepository.createOrUpdateProductVariantSyncLog(
        {
          status: "NOT_STARTED",
          skippedCount: 0,
          syncedCount: 0,
          failedCount: 0,
          totalCount: 0,
          shop: {
            connect: {
              id: shop.id,
            },
          },
        },
      );
    } catch (rollbackError) {
      console.error(
        `Product sync rollout log rollback failed for ${shop.shopUrl}:`,
        rollbackError,
      );
    }

    console.error(
      `Product sync rollout failed for ${shop.shopUrl}:`,
      error,
    );

    await sendLogEvent({
      orgId: shop.orgId,
      errorMessage: error?.message,
      data: JSON.stringify({ domain: logDomain }),
      message: EVENT_MESSAGES.PRODUCT_SYNC_FAILED,
      logLevel: "ERROR",
    }).catch((logError) => {
      console.error(
        `Product sync rollout error log failed for ${shop.shopUrl}:`,
        logError,
      );
    });

    return "failed";
  }

  await sendLogEvent({
    orgId: shop.orgId,
    errorMessage: "",
    data: JSON.stringify({ domain: logDomain }),
    message: EVENT_MESSAGES.PRODUCT_SYNC_ENABLED,
    logLevel: "INFO",
  }).catch((logError) => {
    console.error(
      `Product sync rollout success log failed for ${shop.shopUrl}:`,
      logError,
    );
  });

  return "enabled";
}
