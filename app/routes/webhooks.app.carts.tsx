import type {ActionFunctionArgs} from "@remix-run/node";
import {authenticate} from "~/shopify.server";
import {shopRepository} from "~/repositories/repositories.server";
import {sendStatusCartService} from "~/services/send-status-cart.server";

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
      await sendStatusCartService(payload, shop)
      break;

    default:
      console.warn(`❌ Unhandled webhook topic: ${topic}`);
      return new Response(`Unhandled webhook topic: ${topic}`, {status: 400});
  }

  return new Response("Success", {status: 200});
};
