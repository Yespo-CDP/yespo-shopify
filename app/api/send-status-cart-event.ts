import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";
import type {StatusCartEvent} from "~/@types/statusCart";

/**
 * Sends a "status cart" tracking event to the Yespo web tracker URL.
 *
 * This function sends cart status data using a POST request with an authorization header.
 *
 * @async
 * @function sendStatusCartEvent
 * @param {Object} params - Parameters for sending the status cart event.
 * @param {string} params.apiKey - The API key used to generate the authorization header.
 * @param {StatusCartEvent} params.cartEventData - The data representing the cart status event.
 * @returns {Promise<void>} A promise that resolves when the event is successfully sent.
 * @throws {Error} Throws an error if the request fails and the message is not "Duplicated request".
 *
 * @example
 * await sendStatusCartEvent({
 *   apiKey: "your-api-key",
 *   cartEventData: {
 *     GeneralInfo: {...},
 *     StatusCart: {
 *       GUID: "e3da89da-e17f-470b-ae2b-08a86da04fb8",
 *       Products: [...],
 *     }
 *   }
 * });
 */
export const sendStatusCartEvent = async ({
 apiKey,
 cartEventData
}: {
  apiKey: string;
  cartEventData: StatusCartEvent
}): Promise<void> => {
  const url = `${process.env.WEB_TRACKER_URL}`;
  const authHeader = getAuthHeader(apiKey);
  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(cartEventData),
  };


  try {
   const response =  await fetchWithErrorHandling(url, options);
    console.log('Status Cart event successfully sent with response', JSON.stringify(response, null, 2))
  } catch (error: any) {
    console.error("Error sending status cart:", error?.message);
  }
};
