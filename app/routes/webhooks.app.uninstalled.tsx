import type { ActionFunctionArgs } from "@remix-run/node";

import { shopRepository } from "~/repositories/repositories.server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import getMetafieldDefinition from "~/shopify/queries/get-metafield-definition";
import deleteMetafieldDefinition from "~/shopify/mutations/delete-metafield-definition.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic, admin } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    const definition = await getMetafieldDefinition({
      admin,
      ownerType: "SHOP",
    });

    if (definition) {
      await deleteMetafieldDefinition({ admin, id: definition?.id });
    }

    await shopRepository.updateShop(shop, { apiKey: null, active: false });
    await db.session.deleteMany({ where: { shop } });
  }

  return new Response();
};
