import type { Session } from "@shopify/shopify-api";

import type { Shop } from "~/@types/shop";
import { shopRepository } from "~/repositories/repositories.server";
import afterAuth from "~/services/afterAuth.server";

/**
 * Ensures a `Shop` row exists for the current Shopify session.
 *
 * After `npx prisma migrate reset` Prisma wipes both `Session` and `Shop`.
 * Reopening the app recreates an offline session via token exchange
 * (`offline_<shop>.myshopify.com`) but often skips the `afterAuth` hook
 * (managed installation). The Admin UI still loads with `shop === null`.
 * Connecting an API key then calls `shopRepository.updateShop`, which throws
 * `Shop not found` — shown in the UI as
 * `AccountConnectionSection.errors.Shop not found`.
 *
 * This helper re-runs `afterAuth` (create shop, metafields, webhooks) when
 * the Shop row is missing, then returns the record.
 */
const ensureShop = async ({
  session,
  admin,
}: {
  session: Session;
  admin: any;
}): Promise<Shop | null> => {
  let shop = await shopRepository.getShop(session.shop);
  if (!shop) {
    await afterAuth({ session, admin });
    shop = await shopRepository.getShop(session.shop);
  }
  return shop;
};

export default ensureShop;
