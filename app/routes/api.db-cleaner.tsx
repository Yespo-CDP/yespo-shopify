import type {ActionFunctionArgs} from "@remix-run/node";
import { Receiver } from "@upstash/qstash";
import {eventDataRepository} from "~/repositories/repositories.server";


/**
 * Handles POST requests to trigger bulk deletion of expired event data.
 *
 * This function is designed to be used as a Remix action endpoint, triggered by a QStash-scheduled job.
 * It verifies the request signature using Upstash QStash's Receiver SDK to ensure the request
 * is legitimate. If verification fails, the request is rejected.
 *
 * @async
 * @function action
 * @param {ActionFunctionArgs} args - The Remix action function arguments, including the HTTP request.
 * @returns {Promise<Response>} A response indicating success or failure of the operation.
 *
 * @throws {Error} Returns HTTP 401 if the request signature is invalid.
 *
 * @example
 * // QStash sends a scheduled POST request to this endpoint:
 * POST /api/cleanup-events
 * Headers:
 *   upstash-signature: <signature>
 * Body:
 *   <empty or any content>
 */
export const action = async ({request}: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, message: "Method not allowed" }),
      {status: 405});
  }

  // Init the receiver SDK with your keys. They can be retreived from the
  // Qstash dashboard.
  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || "",
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || "",
  });

  const signature = request.headers.get("upstash-signature") || "";
  const body = await request.text();

  let isValid;

  // Verify that the request being processed is from Qstash
  // If it is not then we don't want to process the request
  try {
    isValid = await receiver.verify({
      signature,
      body,
    });
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ success: false, message: "Invalid signature"}),
      {status: 401});
  }

  if (!isValid) {
    return new Response(
      JSON.stringify({ success: false, message: "Invalid signature"}),
      {status: 401});
  }

  await eventDataRepository.bulkDeleteEventsData()

  return new Response("Success", {status: 200});
};
