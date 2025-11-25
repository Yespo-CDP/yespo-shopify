import type {ActionFunctionArgs} from "react-router";
import {authenticate} from "~/shopify.server";
import {shopRepository} from "~/repositories/repositories.server";
import {sendStatusCartService} from "~/services/send-status-cart.server";

/**
 * Handles incoming Shopify webhook requests, authenticates them, and processes events by topic.
 *
 * Currently supports the "CARTS_UPDATE" webhook topic, forwarding the payload to the status cart service.
 * Silently ignores requests without valid sessions or shops missing an API key.
 * Sends StatusCart event to Yespo web tracker
 * Returns HTTP 400 response for unhandled webhook topics.
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
  if (!shop || !shop?.apiKey) {
    return new Response("Success", {status: 200});
  }

  switch (topic) {
    case "CARTS_UPDATE":
      console.log('CARTS_UPDATE', JSON.stringify(payload, null, 2))
      await sendStatusCartService(payload, shop)
      break;

    default:
      console.warn(`❌ Unhandled webhook topic: ${topic}`);
      return new Response(`Unhandled webhook topic: ${topic}`, {status: 200});
  }

  return new Response("Success", {status: 200});
};
