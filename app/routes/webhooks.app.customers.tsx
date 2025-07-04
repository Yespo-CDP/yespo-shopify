import type { ActionFunctionArgs } from '@remix-run/node'
import { authenticate } from '../shopify.server'
import {shopRepository} from "~/repositories/repositories.server";
import {createContactService} from "~/services/create-contact.server";
import {updateContactService} from "~/services/update-contact.service";

export const action = async ({request}: ActionFunctionArgs) => {
  const { topic, session, payload, webhookId } =
    await authenticate.webhook(request)
  console.log(`Received ${topic} webhook for ${session.shop} webhookId ${webhookId}`);

  const shop = await shopRepository.getShop(session.shop);

  if (!shop || !shop?.apiKey) {
    return new Response("Success", {status: 200});
  }

  switch (topic) {
    case "CUSTOMERS_CREATE":
      await createContactService(payload, shop.apiKey)
      break;

    case "CUSTOMERS_UPDATE":
      await updateContactService(payload, shop.apiKey)
      break;

    default:
      console.warn(`❌ Unhandled webhook topic: ${topic}`);
      return new Response(`Unhandled webhook topic: ${topic}`, {status: 400});
  }

  return new Response("Success", {status: 200});
};
