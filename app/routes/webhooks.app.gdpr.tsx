import type { ActionFunctionArgs } from "react-router";
import crypto from "node:crypto";

import {
  gdprCustomerDataRepository,
  shopRepository,
} from "~/repositories/repositories.server";
import { authenticate } from "../shopify.server";
import { deleteContactService } from "~/services/delete-contact.service";

/**
 * Action handler for processing Shopify webhooks with HMAC validation.
 *
 * Steps performed:
 * 1. Clones the incoming request to read raw payload.
 * 2. Extracts and validates the Shopify webhook HMAC signature against the raw payload.
 * 3. Authenticates the webhook and retrieves shop info, topic, payload, and webhookId.
 * 4. If the shop or its API key is missing, responds with HTTP 200 to acknowledge.
 * 5. Handles specific webhook topics:
 *    - "CUSTOMERS_DATA_REQUEST": Creates a customer data request record.
 *    - "CUSTOMERS_REDACT": Deletes customer contact data securely.
 *    - "SHOP_REDACT": Deletes the entire shop data from the repository.
 * 6. Responds with HTTP 400 if the topic is unhandled.
 *
 * Returns HTTP 401 if HMAC validation fails or secret is missing.
 *
 * @param {ActionFunctionArgs} args - The arguments containing the request.
 * @returns {Promise<Response>} The HTTP response indicating success, failure, or unhandled topic.
 */

export const action = async ({ request }: ActionFunctionArgs) => {
  const requestClone = request.clone();
  const rawPayload = await request.text();

  const signature = request.headers.get("x-shopify-hmac-sha256");
  const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;

  const { shop, topic, payload, webhookId } =
    await authenticate.webhook(requestClone);
  console.log(`Received ${topic} webhook for ${shop}`);

  if (!SHOPIFY_API_SECRET) {
    console.error(
      "Webhook HMAC validation failed: SHOPIFY_API_SECRET is missing.",
    );
    return new Response("Webhook HMAC validation failed", { status: 401 });
  }

  const generatedSignature = crypto
    .createHmac("sha256", SHOPIFY_API_SECRET)
    .update(rawPayload)
    .digest("base64");

  if (signature !== generatedSignature) {
    console.error("Webhook HMAC validation failed: signature does not match.");
    return new Response("Webhook HMAC validation failed", { status: 401 });
  }
  const store = await shopRepository.getShop(shop);

  if (!store || !store?.apiKey) {
    return new Response("Success", { status: 200 });
  }
  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      const customerDataRequest = {
        webhookId,
        topic,
        payload: JSON.stringify(payload),
        shop: {
          connect: {
            id: store.id,
          },
        },
      };
      await gdprCustomerDataRepository.createGdprCustomerDataRequest(
        customerDataRequest,
      );
      break;

    case "CUSTOMERS_REDACT":
      if (store?.isContactSyncEnabled) {
        await deleteContactService(
          payload.customer.id.toString(),
          store.apiKey,
          true,
        );
      }
      break;

    case "SHOP_REDACT":
      const shopData = await shopRepository.getShop(shop);
      if (shopData) {
        await shopRepository.deleteShop(shop);
      } else {
        console.log(
          `📌 No shop data stored. Acknowledging shop deletion request for shop: ${shop}`,
        );
      }
      break;
    default:
      console.warn(`❌ Unhandled webhook topic: ${topic}`);
      return new Response(`Unhandled webhook topic: ${topic}`, { status: 200 });
  }

  return new Response("Success", { status: 200 });
};
