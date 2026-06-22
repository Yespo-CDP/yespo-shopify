import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { shopRepository } from "~/repositories/repositories.server";
import { createProductVariantService } from "~/services/create-product-variant.server";
import { updateProductVariantService } from "~/services/update-product-variant.server";
import { deleteProductVariantService } from "~/services/delete-product-variant.service";

/**
 * Action handler for processing incoming Shopify product webhooks.
 *
 * Supported webhook topics:
 * - "PRODUCTS_CREATE": Calls `createProductVariantService` with payload and shop API key.
 * - "PRODUCTS_UPDATE": Calls `updateProductVariantService` with payload and shop API key.
 * - "PRODUCTS_DELETE": Calls `deleteProductVariantService` with payload and shop API key.
 *
 * If the session does not exist, responds with HTTP 200.
 * If the shop is not found or does not have an API key, responds with HTTP 200.
 * If product variant sync is disabled, responds with HTTP 200.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, session, payload, webhookId } =
    await authenticate.webhook(request);

  if (!session) {
    return new Response("Success", { status: 200 });
  }
  console.log(
    `Received ${topic} webhook for ${session.shop} webhookId ${webhookId}`,
  );

  const shop = await shopRepository.getShop(session.shop);

  if (!shop || !shop?.apiKey || !shop?.isProductVariantSyncEnabled) {
    return new Response("Success", { status: 200 });
  }

  switch (topic) {
    case "PRODUCTS_CREATE":
      await createProductVariantService(
        payload,
        shop.apiKey,
        shop.id,
        shop.shopUrl,
        shop.orgId,
        shop.siteId,
      );
      break;

    case "PRODUCTS_UPDATE":
      await updateProductVariantService(
        payload,
        shop.apiKey,
        shop.id,
        shop.shopUrl,
        shop.orgId,
        shop.siteId,
      );
      break;

    case "PRODUCTS_DELETE":
      await deleteProductVariantService(
        payload,
        shop.apiKey,
        shop.shopUrl,
        shop.orgId,
        shop.siteId,
      );
      break;

    default:
      console.warn(`❌ Unhandled webhook topic: ${topic}`);
      return new Response(`Unhandled webhook topic: ${topic}`, { status: 200 });
  }

  return new Response("Success", { status: 200 });
};
