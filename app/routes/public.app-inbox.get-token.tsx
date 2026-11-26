// Shared CORS headers
import type {ActionFunctionArgs} from "react-router";
import {getContactToken} from "~/services/get-contact-token.server";
import {shopRepository} from "~/repositories/repositories.server";
import {
  isValidSignature,
  readCustomer,
  readSignedData,
} from "~/services/event-data-signature.server";

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
 * Returns a Yespo App Inbox token for the customer signed by yespo-script.liquid.
 *
 * Supports CORS preflight with OPTIONS method.
 * Expects a POST request with JSON body `{ signedData, signature }` (the same
 * signature as `/public/event-data`). `shop` and the customer come only from
 * `signedData`; other body fields are ignored.
 * An invalid signature or malformed `signedData` is answered with 400.
 * No signature, an unknown shop, a shop without `apiKey`, `publicApiKey` or
 * enabled App Inbox, or a signed guest get `{ success: true, token: "" }`.
 *
 * @async
 * @function action
 * @param {ActionFunctionArgs} args - Remix action function arguments including the HTTP request.
 * @param {Request} args.request - The incoming HTTP request.
 * @returns {Promise<Response>} JSON response with the token or an error.
 *
 * @example
 * // Example request body:
 * {
 *   "signedData": "{\"shop\":\"example-shop.myshopify.com\",\"marketId\":\"ua\",\"customer\":{\"id\":123,...}}",
 *   "signature": "<HMAC-SHA256 hex of signedData>"
 * }
 */
export const action = async ({request}: ActionFunctionArgs) => {
  // Handle CORS preflight request
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const data = await request.json();

    // null is the same as absent: the page sends it until the shop has a key
    if (data.signedData == null && data.signature == null) {
      return jsonResponse({ success: true, token: "" });
    }

    const signedData = readSignedData(data.signedData);
    if (!signedData) {
      console.error(
        "App Inbox token refused: signedData is missing or malformed",
      );
      return jsonResponse({ success: false, error: "Invalid signature" }, 400);
    }

    const shop = await shopRepository.getShopByDomain(signedData.shop);
    if (!shop?.apiKey || shop.isAppInboxEnabled !== true || !shop.publicApiKey) {
      return jsonResponse({ success: true, token: "" });
    }

    if (!isValidSignature(data.signedData, data.signature, shop.publicApiKey)) {
      const domain = signedData.shop.replace(/[\p{C}\s]/gu, "").slice(0, 100);
      console.error(
        `App Inbox token refused for ${domain}: the signature does not match`,
      );
      return jsonResponse({ success: false, error: "Invalid signature" }, 400);
    }

    const customer = readCustomer(signedData.customer);
    if (!customer) {
      return jsonResponse({ success: true, token: "" });
    }

    const token = await getContactToken(
      shop.apiKey,
      {
      externalCustomerId: customer.customerId,
      email: customer.email,
      phone: customer.phone
    })

    return jsonResponse({ success: true, token });
  } catch (error: any) {
    // name and code only: the message may contain personal data from the request
    const code = error?.code ? ` ${error.code}` : "";
    console.error(`Failed to get contact auth token: ${error?.name}${code}`);
    return jsonResponse({ success: false, error: "Bad request" }, 400);
  }
}
