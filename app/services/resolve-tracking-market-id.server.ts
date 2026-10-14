import { unauthenticated } from "~/shopify.server";
import getMetafield from "~/shopify/queries/get-metafield";

import { countStorefrontHosts, shouldTrackMarketId } from "./market-tracking";

const WEB_PUSH_MULTI_DOMAIN_HANDLE =
  process.env.WEB_PUSH_MULTI_DOMAIN_HANDLE ?? "yespo-web-push-multi-domain";

/**
 * Hosts stored in the web push multi-domain metafield.
 * A missing metafield or a failed read counts as zero hosts.
 */
export async function loadStorefrontHostCount(shopUrl: string): Promise<number> {
  if (!shopUrl) return 0;

  try {
    const { admin } = await unauthenticated.admin(shopUrl);
    const metafield = await getMetafield({
      admin,
      key: WEB_PUSH_MULTI_DOMAIN_HANDLE,
    });
    return countStorefrontHosts(metafield?.value);
  } catch (error) {
    console.error(`Failed to read web push domains for ${shopUrl}:`, error);
    return 0;
  }
}

/**
 * Returns the market id to put on a backend tracking event.
 * Omits it when the visit has none, or the multi-domain metafield lists
 * one storefront or none.
 */
export async function resolveTrackingMarketId(
  shopUrl: string,
  storedMarketId: string | null | undefined,
): Promise<string | undefined> {
  if (!storedMarketId) return undefined;

  const hostCount = await loadStorefrontHostCount(shopUrl);
  if (!shouldTrackMarketId(hostCount)) {
    return undefined;
  }

  return storedMarketId;
}
