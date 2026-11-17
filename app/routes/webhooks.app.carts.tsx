import type {ActionFunctionArgs} from "react-router";
import {authenticate} from "~/shopify.server";
import {shopRepository} from "~/repositories/repositories.server";
import {enqueueWebhookEvent} from "~/services/queue";

/**
 * Handles carts/update webhooks.
 *
 * Authenticates the request, queues the webhook for the worker (`webhookEventHandler`,
 * which sends the StatusCart event to the Yespo web tracker) and responds with HTTP 200
 * right away, so Yespo requests do not run inside Shopify's 5-second limit.
 * Silently ignores requests without valid sessions, shops missing an API key or with web tracking disabled.
 * If Redis rejects the job, the error is thrown (HTTP 500) so Shopify retries; while
 * Redis is unreachable the request waits and Shopify retries after its 5-second timeout.
 *
 * @async
 * @function action
 * @param {ActionFunctionArgs} args - Remix action function arguments containing the HTTP request.
 * @param {Request} args.request - The incoming webhook HTTP request.
 * @returns {Promise<Response>} A response indicating success or failure of webhook processing.
 *
 * @example
 * await action({ request });
 */
export const action = async ({request}: ActionFunctionArgs) => {
  const { topic, session, payload, webhookId } =
    await authenticate.webhook(request)

  if (!session) {
    return new Response("Success", {status: 200});
  }
  console.log(`Received ${topic} webhook for ${session.shop} webhookId ${webhookId}`);

  const shop = await shopRepository.getShop(session.shop);
  if (!shop || !shop.apiKey || !shop.isWebTrackingEnabled) {
    return new Response("Success", {status: 200});
  }

  await enqueueWebhookEvent({shop: session.shop, topic, payload}, webhookId);

  return new Response("Success", {status: 200});
};
