import type { ActionFunctionArgs } from "react-router";
import { addDays } from "date-fns";
import {
  customerRepository,
  eventDataRepository,
  shopRepository,
} from "~/repositories/repositories.server";
import {
  isValidSignature,
  readCustomer,
  readSignedData,
  readString,
} from "~/services/event-data-signature.server";
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

/**
 * Handles incoming HTTP requests to create or update event data.
 *
 * Supports CORS preflight with OPTIONS method.
 * Expects a POST request with JSON body containing at least `shop`, `sc`, and `cartToken`.
 * Silently accepts incomplete data or unknown shops without error.
 * A customer is accepted only from `signedData` with a valid `signature`; then `shop`
 * and `marketId` come from `signedData` too. An invalid signature is answered with 400.
 * Without a signature, or when the shop has no key yet, the cart is saved without a customer.
 * If a signed customer is present, upserts only its expected fields.
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
 *   "marketId": "ua",
 *   "signedData": "{\"shop\":\"example-shop.myshopify.com\",\"marketId\":\"ua\",\"customer\":{\"id\":123,...}}",
 *   "signature": "<HMAC-SHA256 hex of signedData>"
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
    // null is the same as absent: the page sends it until the shop has a key
    const isSigned = data.signedData != null || data.signature != null;
    const signedData = isSigned ? readSignedData(data.signedData) : null;
    const shopDomain = signedData?.shop ?? readString(data.shop);
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

    // Stays null unless the signature is checked and valid.
    let trusted: ReturnType<typeof readSignedData> = null;
    if (isSigned && shop.publicApiKey) {
      if (
        !signedData ||
        !isValidSignature(data.signedData, data.signature, shop.publicApiKey)
      ) {
        const domain = shopDomain.replace(/[\p{C}\s]/gu, "").slice(0, 100);
        const reason = signedData
          ? "the signature does not match"
          : "signedData is missing or malformed";
        console.error(`Event data refused for ${domain}: ${reason}`);
        return jsonResponse({ success: false, error: "Invalid signature" }, 400);
      }
      trusted = signedData;
    }

    const customerData = readCustomer(trusted?.customer);
    const customer = customerData
      ? await customerRepository.upsertCustomer(customerData)
      : null;

    await eventDataRepository.createEventData({
      cartToken,
      sc,
      marketId: readMarketId((trusted ?? data).marketId),
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
