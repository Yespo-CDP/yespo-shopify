import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "~/shopify.server";
import { shopRepository } from "~/repositories/repositories.server";
import { enqueueWebhookEvent } from "~/services/queue";

/**
 * Handles orders/create and orders/updated webhooks.
 *
 * Authenticates the request, queues the webhook for the worker (`webhookEventHandler`,
 * which sends PurchasedItems and/or the order to Yespo) and responds with HTTP 200
 * right away, so Yespo requests do not run inside Shopify's 5-second limit.
 * Silently ignores requests with no valid session or shops without an API key.
 * If Redis rejects the job, the error is thrown (HTTP 500) so Shopify retries; while
 * Redis is unreachable the request waits and Shopify retries after its 5-second timeout.
 *
 * @async
 * @function action
 * @param {ActionFunctionArgs} args - Remix action function arguments containing the HTTP request.
 * @param {Request} args.request - The incoming HTTP request representing the webhook.
 * @returns {Promise<Response>} A response indicating the result of processing the webhook.
 *
 * @example
 * // Typical webhook request processing flow:
 * await action({ request });
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
  if (!shop || !shop?.apiKey) {
    return new Response("Success", { status: 200 });
  }

  await enqueueWebhookEvent({ shop: session.shop, topic, payload }, webhookId);

  return new Response("Success", { status: 200 });
};
