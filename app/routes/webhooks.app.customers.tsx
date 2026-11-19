import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { shopRepository } from "~/repositories/repositories.server";
import { enqueueWebhookEvent } from "~/services/queue";

/**
 * Action handler for customers/create and customers/update webhooks.
 *
 * Authenticates the webhook request, retrieves the associated shop, queues the
 * webhook for the worker (`webhookEventHandler`) and responds with HTTP 200 right
 * away, so Yespo requests do not run inside Shopify's 5-second limit.
 *
 * If the session is not exist responds with HTTP 200.
 * If the shop is not found or does not have an API key, responds with HTTP 200.
 * If sync contacts disabled responds with HTTP 200.
 * If Redis rejects the job, the error is thrown (HTTP 500) so Shopify retries; while
 * Redis is unreachable the request waits and Shopify retries after its 5-second timeout.
 *
 * @param {ActionFunctionArgs} args - The arguments containing the request.
 * @returns {Promise<Response>} An HTTP response indicating success or failure.
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

  if (!shop || !shop?.apiKey || !shop?.isContactSyncEnabled) {
    return new Response("Success", { status: 200 });
  }

  await enqueueWebhookEvent({ shop: session.shop, topic, payload }, webhookId);

  return new Response("Success", { status: 200 });
};
