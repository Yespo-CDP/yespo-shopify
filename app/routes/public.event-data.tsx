import type {ActionFunctionArgs} from "@remix-run/node";
import {addDays} from "date-fns";
import {customerRepository, eventDataRepository, shopRepository} from "~/repositories/repositories.server";

// Shared CORS headers
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

/**
 * Handles incoming HTTP requests to create or update event data.
 *
 * Supports CORS preflight with OPTIONS method.
 * Expects a POST request with JSON body containing at least `shop`, `sc`, and `cartToken`.
 * Silently accepts incomplete data or unknown shops without error.
 * If customer data is present, upserts the customer record.
 * Creates or updates event data with a TTL of 14 days.
 *
 * @async
 * @function action
 * @param {ActionFunctionArgs} args - Remix action function arguments including the HTTP request.
 * @param {Request} args.request - The incoming HTTP request.
 * @returns {Promise<Response>} JSON response indicating success or failure.
 *
 * @example
 * // Example request body:
 * {
 *   "shop": "example-shop.myshopify.com",
 *   "sc": "...",
 *   "cartToken": "token123",
 *   "customer": {
 *     "id": "cust123",
 *     "email": "customer@example.com",
 *     ...,
 *   }
 * }
 */
export const action = async ({request}: ActionFunctionArgs) => {
  // Handle CORS preflight request
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const data = await request.json();
    console.log('Public event data', data)
    if (!data.shop || !data.sc || !data.cartToken) {
      return jsonResponse({ success: true }); // early return if data is incomplete
    }

    const shop = await shopRepository.getShopByDomain(data.shop);
    if (!shop) {
      return jsonResponse({ success: true }); // silently accept even if shop not found
    }

    const { id, ...customerWithoutId } = data.customer || {};
    const customer = data.customer ? await customerRepository.upsertCustomer({ customerId: data.customer.id.toString(), ...customerWithoutId }) : null

    await eventDataRepository.createEventData({
      cartToken: data.cartToken,
      sc: data.sc,
      ttl: addDays(new Date(), 14),
      shop: {
        connect: { id: shop.id },
      },
      ...(customer
        ? {
          customer: {
            connect: {
              customerId: customer.customerId,
            },
          },
        }
        : {}),
    });

    return jsonResponse({ success: true });
  } catch (error: any) {
    console.error("Failed to save event data:", error);
    return jsonResponse({ success: false, error: error.message || "Unknown error" }, 400);
  }
}
