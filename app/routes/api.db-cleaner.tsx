import type {ActionFunctionArgs} from "@remix-run/node";
import { Receiver } from "@upstash/qstash";
import {eventDataRepository} from "~/repositories/repositories.server";

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
