import type { ActionFunctionArgs } from "@remix-run/node";
import crypto from "node:crypto";

import {gdprCustomerDataRepository, shopRepository} from "~/repositories/repositories.server";
import { authenticate } from "../shopify.server";
import {deleteContactService} from "~/services/delete-contact.service";

export const action = async ({ request }: ActionFunctionArgs) => {
  const requestClone = request.clone();
  const rawPayload = await request.text();

  const signature = request.headers.get("x-shopify-hmac-sha256");
  const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;

  const { shop, topic, payload, webhookId } = await authenticate.webhook(requestClone);
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
    return new Response("Success", {status: 200});
  }
  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      const customerDataRequest = {
        webhookId,
        topic,
        payload: JSON.stringify(payload),
        shop: {
          connect: {
            id: store.id
          }
        }
      }
      await gdprCustomerDataRepository.createGdprCustomerDataRequest(customerDataRequest)
      break;
    case "CUSTOMERS_REDACT":
      await deleteContactService(payload.customer.id.toString(), store.apiKey, true)
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
      return new Response(`Unhandled webhook topic: ${topic}`, { status: 400 });
  }

  return new Response("Success", { status: 200 });
};
