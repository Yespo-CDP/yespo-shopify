import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { shopRepository } from "~/repositories/repositories.server";
import {
  enqueueProductWebhookJob,
  type ProductWebhookTopic,
} from "~/services/queue";

const PRODUCT_WEBHOOK_TOPICS = new Set<ProductWebhookTopic>([
  "PRODUCTS_CREATE",
  "PRODUCTS_UPDATE",
  "PRODUCTS_DELETE",
]);

/**
 * Product webhooks are acknowledged immediately and processed by the worker.
 *
 * Shopify delivers products/create and products/update within seconds of each
 * other during a CSV import. The queue coalesces those into one job per
 * product, then the worker reads the product from the Admin API.
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

  if (!shop || !shop.apiKey || !shop.isProductVariantSyncEnabled) {
    return new Response("Success", { status: 200 });
  }

  if (!PRODUCT_WEBHOOK_TOPICS.has(topic as ProductWebhookTopic)) {
    console.warn(`Unhandled webhook topic: ${topic}`);
    return new Response(`Unhandled webhook topic: ${topic}`, { status: 200 });
  }

  const productGid = productGidFromWebhook(topic, payload);
  if (!productGid) {
    console.warn(`Product webhook ${topic} missing product id — skipping`);
    return new Response("Success", { status: 200 });
  }

  await enqueueProductWebhookJob({
    shop: session.shop,
    shopId: shop.id,
    topic: topic as ProductWebhookTopic,
    productGid,
  });

  console.log(
    `Queued ${topic} for ${session.shop} product ${productGid} webhookId ${webhookId}`,
  );

  return new Response("Success", { status: 200 });
};

function productGidFromWebhook(
  topic: string,
  payload: { id?: number | string; admin_graphql_api_id?: string },
): string | null {
  if (topic === "PRODUCTS_DELETE") {
    if (payload?.id == null || payload.id === "") return null;
    return `gid://shopify/Product/${payload.id}`;
  }

  return payload?.admin_graphql_api_id || null;
}
