import type { ActionFunctionArgs } from "react-router";
import { addDays } from "date-fns";
import {
  customerRepository,
  eventDataRepository,
  shopRepository,
} from "~/repositories/repositories.server";
import { readMarketId } from "~/services/market-tracking";

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

const MAX_LENGTH = 255;

// A string of reasonable length, else undefined (the field is not saved).
const readString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length <= MAX_LENGTH ? value : undefined;

/**
 * Takes only the expected customer fields from the storefront body.
 * A field that is not a short string or null is dropped, so it is not updated.
 * Returns null when `id` is not a Shopify customer id (number or digits).
 */
const readCustomer = (value: unknown) => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id =
    typeof raw.id === "number" && Number.isSafeInteger(raw.id)
      ? String(raw.id)
      : raw.id;
  if (typeof id !== "string" || !/^\d{1,20}$/.test(id)) return null;
  const field = (key: string) =>
    raw[key] === null ? null : readString(raw[key]);
  return {
    customerId: id,
    email: field("email"),
    phone: field("phone"),
    firstName: field("firstName"),
    lastName: field("lastName"),
  };
};

/**
 * Handles incoming HTTP requests to create or update event data.
 *
 * Supports CORS preflight with OPTIONS method.
 * Expects a POST request with JSON body containing at least `shop`, `sc`, and `cartToken`.
 * Silently accepts incomplete data or unknown shops without error.
 * If customer data is present, upserts only its expected fields.
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
 *     "id": 123,
 *     "email": "customer@example.com",
 *     ...,
 *   }
 * }
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  // Handle CORS preflight request
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const data = await request.json();
    const sc = readString(data.sc);
    const cartToken = readString(data.cartToken);
    const shopDomain = readString(data.shop);
    if (!shopDomain || !sc || !cartToken) {
      return jsonResponse({ success: true, error: null }); // early return if data is incomplete
    }

    const shop = await shopRepository.getShopByDomain(shopDomain);
    if (!shop) {
      return jsonResponse({
        success: true,
        error: `Shop ${shopDomain} not found`,
      }); // silently accept even if shop not found
    }

    const customerData = readCustomer(data.customer);
    const customer = customerData
      ? await customerRepository.upsertCustomer(customerData)
      : null;

    await eventDataRepository.createEventData({
      cartToken,
      sc,
      marketId: readMarketId(data.marketId),
      ttl: addDays(new Date(), 14),
      shopId: shop.id,
      customerId: customer?.customerId,
    });

    return jsonResponse({ success: true, error: null });
  } catch (error: any) {
    console.error("Failed to save event data:", error);
    return jsonResponse(
      { success: false, error: error.message || "Unknown error" },
      400,
    );
  }
};
