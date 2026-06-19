import type { ActionFunctionArgs } from "react-router";
import { Receiver } from "@upstash/qstash";

import {
  enqueueMarketSyncTaskForShopUrl,
  enqueueMarketSyncTasks,
} from "~/services/queue";
import { shopRepository } from "~/repositories/repositories.server";
import { authenticate } from "~/shopify.server";

/**
 * QStash-scheduled endpoint that enqueues daily market sync jobs.
 * Also accepts authenticated admin POST requests (temporary dev trigger from dashboard).
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, message: "Method not allowed" }),
      { status: 405 },
    );
  }

  const signature = request.headers.get("upstash-signature");

  if (signature) {
    const receiver = new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || "",
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || "",
    });

    const body = await request.text();

    try {
      const isValid = await receiver.verify({
        signature,
        body,
      });

      if (!isValid) {
        return new Response(
          JSON.stringify({ success: false, message: "Invalid signature" }),
          { status: 401 },
        );
      }
    } catch (error) {
      console.error(error);
      return new Response(
        JSON.stringify({ success: false, message: "Invalid signature" }),
        { status: 401 },
      );
    }

    const enqueued = await enqueueMarketSyncTasks();

    return new Response(JSON.stringify({ success: true, enqueued }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { session } = await authenticate.admin(request);
    const shop = await shopRepository.getShop(session.shop);

    if (!shop) {
      return new Response(
        JSON.stringify({ success: false, message: "Shop not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!shop.apiKey) {
      return new Response(
        JSON.stringify({ success: false, message: "Yespo account not connected" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    await shopRepository.updateShop(session.shop, {
      isMarketSyncEnabled: true,
    });

    const enqueued = await enqueueMarketSyncTaskForShopUrl(session.shop);

    return new Response(JSON.stringify({ success: true, enqueued }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ success: false, message: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
};
