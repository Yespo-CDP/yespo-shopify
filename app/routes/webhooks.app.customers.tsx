import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { shopRepository } from "~/repositories/repositories.server";
import { createContactService } from "~/services/create-contact.server";
import { updateContactService } from "~/services/update-contact.service";

/**
 * Action handler for processing incoming Shopify webhooks.
 *
 * Authenticates the webhook request, retrieves the associated shop,
 * and processes the webhook payload based on the webhook topic.
 *
 * Supported webhook topics:
 * - "CUSTOMERS_CREATE": Calls `createContactService` with payload and shop API key.
 * - "CUSTOMERS_UPDATE": Calls `updateContactService` with payload and shop API key.
 *
 * If the session is not exist responds with HTTP 200.
 * If the shop is not found or does not have an API key, responds with HTTP 200.
 * If sync contacts disabled responds with HTTP 200.
 * If the webhook topic is unhandled, responds with HTTP 400 and logs a warning.
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

  switch (topic) {
    case "CUSTOMERS_CREATE":
      await createContactService(payload, shop.apiKey, shop.id);
      break;

    case "CUSTOMERS_UPDATE":
      await updateContactService(payload, shop.apiKey, shop.id);
      break;

    default:
      console.warn(`❌ Unhandled webhook topic: ${topic}`);
      return new Response(`Unhandled webhook topic: ${topic}`, { status: 200 });
  }

  return new Response("Success", { status: 200 });
};
