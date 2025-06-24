import type {ActionFunctionArgs} from "@remix-run/node";
import {addDays} from "date-fns";
import {eventDataRepository, shopRepository} from "~/repositories/repositories.server";

// Shared CORS headers
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

// Helper to create a response
const jsonResponse = (data: object, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });

export const action = async ({request}: ActionFunctionArgs) => {
  // Handle CORS preflight request
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const data = await request.json();
    if (!data.shop || !data.sc || !data.cartToken) {
      return jsonResponse({ success: true }); // early return if data is incomplete
    }

    const shop = await shopRepository.getShop(data.shop);
    if (!shop) {
      return jsonResponse({ success: true }); // silently accept even if shop not found
    }

    await eventDataRepository.createEventData({
      cartToken: data.cartToken,
      sc: data.sc,
      ttl: addDays(new Date(), 14),
      shop: {
        connect: { id: shop.id },
      },
    });

    return jsonResponse({ success: true });
  } catch (error: any) {
    console.error("Failed to save event data:", error);
    return jsonResponse({ success: false, error: error.message || "Unknown error" }, 400);
  }
}
