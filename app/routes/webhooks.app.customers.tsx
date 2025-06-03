import type { ActionFunctionArgs } from '@remix-run/node'
import { authenticate } from '../shopify.server'
import {shopRepository} from "~/repositories/repositories.server";
import {createContactService} from "~/services/create-contact.server";
import {updateContactService} from "~/services/update-contact.service";
import {deleteContactService} from "~/services/delete-contact.service";

export const action = async ({request}: ActionFunctionArgs) => {
  const { topic, session, payload } =
    await authenticate.webhook(request)
  console.log(`Received ${topic} webhook for ${session.shop}`);

  const shop = await shopRepository.getShop(session.shop);

  if (!shop || !shop?.apiKey) {
    return new Response("Success", {status: 200});
  }

  switch (topic) {
    case "CUSTOMERS_CREATE":
      console.log('CUSTOMERS_CREATE', JSON.stringify(payload, null, 2));
      await createContactService(payload, shop.apiKey)
      break;

    case "CUSTOMERS_UPDATE":
      console.log('CUSTOMERS_UPDATE', JSON.stringify(payload, null, 2))
      await updateContactService(payload, shop.apiKey)
      break;

    case "CUSTOMERS_DELETE":
      console.log(`CUSTOMERS_DELETE`);
      await deleteContactService(payload.id.toString(), shop.apiKey, false)
      break;
    default:
      console.warn(`❌ Unhandled webhook topic: ${topic}`);
      return new Response(`Unhandled webhook topic: ${topic}`, {status: 400});
  }

  return new Response("Success", {status: 200});
};
