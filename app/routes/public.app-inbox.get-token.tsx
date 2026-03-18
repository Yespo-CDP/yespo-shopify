// Shared CORS headers
import type {ActionFunctionArgs} from "react-router";
import {getContactToken} from "~/services/get-contact-token.server";
import {shopRepository} from "~/repositories/repositories.server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

/**
 * Creates a JSON HTTP response with appropriate CORS headers.
 *
 * @param {object} data - The data object to serialize as JSON in the response body.
 * @param {number} [status=200] - The HTTP status code of the response.
 * @returns {Response} A Response object with JSON body and CORS headers.
 */
// Helper to create a response
const jsonResponse = (data: object, status: number = 200): Response =>
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
    console.log('PUBLIC APP INBOX GET TOKEN', data)

    if (!data.shop) {
      return jsonResponse({ success: true }); // early return if data is incomplete
    }

    const shop = await shopRepository.getShopByDomain(data.shop);
    if (!shop || !shop?.apiKey) {
      return jsonResponse({ success: true }); // silently accept even if shop not found
    }

    const token = await getContactToken(
      shop.apiKey,
      {
      externalCustomerId: data.externalCustomerId,
      email: data.email,
      phone: data.phone
    })

    return jsonResponse({ success: true, token });
  } catch (error: any) {
    console.error("Failed to save event data:", error);
    return jsonResponse({ success: false, error: error.message || "Unknown error" }, 400);
  }
}
