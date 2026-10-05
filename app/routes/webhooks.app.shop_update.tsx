import type { ActionFunctionArgs } from "react-router";

import { shopRepository } from "~/repositories/repositories.server";
import { authenticate } from "../shopify.server";

/**
 * Handles the Shopify `shop/update` webhook.
 *
 * Overwrites the stored shop email, name, and primary domain.
 * The webhook `domain` is the shop's primary domain host, matching
 * `primaryDomain.host` saved during install.
 *
 * Returns HTTP 200 when the session or shop record is missing so Shopify
 * does not retry a store that is no longer installed.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (!session) {
    return new Response();
  }

  const existing = await shopRepository.getShop(shop);
  if (!existing) {
    return new Response();
  }

  const email = typeof payload.email === "string" ? payload.email : undefined;
  const name = typeof payload.name === "string" ? payload.name : undefined;
  const domain = typeof payload.domain === "string" ? payload.domain : undefined;

  await shopRepository.updateShop(shop, {
    ...(email !== undefined ? { email } : {}),
    ...(name !== undefined ? { name } : {}),
    ...(domain !== undefined ? { domain } : {}),
  });

  return new Response();
};
