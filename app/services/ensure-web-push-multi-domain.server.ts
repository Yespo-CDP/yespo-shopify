import getMetafield from "~/shopify/queries/get-metafield";
import { shopRepository } from "~/repositories/repositories.server";
import { hasReadMarketsScope } from "~/services/market-scopes";
import { syncMarketWebPushScripts } from "~/services/sync-market-web-push-scripts.server";

const WEB_PUSH_MULTI_DOMAIN_HANDLE =
  process.env.WEB_PUSH_MULTI_DOMAIN_HANDLE ?? "yespo-web-push-multi-domain";

export type WebPushMultiDomainResult = "filled" | "skipped" | "failed";

/**
 * When `read_markets` is granted, creates the multi-domain web push metafield
 * if it has no value yet: registers storefront hosts and writes their scripts.
 * A stored value means the shop is already done, so later page loads only read it.
 */
export async function ensureWebPushMultiDomain({
  admin,
  shopUrl,
  scopes,
}: {
  admin: any;
  shopUrl: string;
  scopes: string | string[] | null | undefined;
}): Promise<WebPushMultiDomainResult> {
  if (!hasReadMarketsScope(scopes)) {
    return "skipped";
  }

  const shop = await shopRepository.getShop(shopUrl);
  if (
    !shop?.apiKey ||
    !shop.shopId ||
    shop.active !== true ||
    !shop.isWebPushScriptInstalled
  ) {
    return "skipped";
  }

  const existing = await getMetafield({
    admin,
    key: WEB_PUSH_MULTI_DOMAIN_HANDLE,
  });
  if (existing?.value) {
    return "skipped";
  }

  try {
    await syncMarketWebPushScripts({
      admin,
      apiKey: shop.apiKey,
      shopId: shop.shopId,
      domain: shop.domain || shop.shopUrl,
      orgId: shop.orgId,
    });
  } catch (error) {
    console.error(
      `Web push multi-domain setup failed for ${shop.shopUrl}:`,
      error,
    );
    return "failed";
  }

  return "filled";
}
