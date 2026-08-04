import {getAuthHeader} from "~/utils/auth";
import {fetchWithErrorHandling} from "~/utils/fetchWithErrorHandling";
import type {PurchasedItemsEvent} from "~/@types/purchasedItems";
import {sendLogEvent} from "~/api/send-log-event";
import {EVENT_MESSAGES} from "~/config/constants";

/**
 * Sends a "purchased items" tracking event to the Yespo web tracker URL.
 *
 * This function constructs an authenticated POST request with the purchased items data
 * and sends it to the tracking endpoint defined in the environment.
 *
 * @async
 * @function sendPurchasedItemsEvent
 * @param {Object} params - Parameters for sending the purchased items event.
 * @param {string} params.apiKey - The API key used to generate the authorization header.
 * @param {PurchasedItemsEvent} params.purchasedItemsData - The data representing the purchased items event.
 * @returns {Promise<void>} A promise that resolves when the event is successfully sent.
 * @throws Will log an error to the console if the request fails.
 *
 * @example
 * await sendPurchasedItemsEvent({
 *   apiKey: "your-api-key",
 *   purchasedItemsData: {
 *     GeneralInfo: {...},
 *     TrackedOrderId: "e3da89da-e17f-470b-ae2b-08a86da04fb8",
 *     PurchasedItems: {
 *       Products: [...],
 *       OrderNumber: "6518724034798"
 *     }
 *   }
 * });
 */
export const sendPurchasedItemsEvent = async ({
  apiKey,
  purchasedItemsData,
  domain,
  orgId
}: {
  apiKey: string;
  purchasedItemsData: PurchasedItemsEvent;
  domain: string;
  orgId?: number | null;
}): Promise<void> => {
  const url = `${process.env.WEB_TRACKER_URL}`;
  const authHeader = getAuthHeader(apiKey);
  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(purchasedItemsData),
  };

  try {
    const response = await fetchWithErrorHandling(url, options);

    await sendLogEvent({
      orgId,
      errorMessage: '',
      data: {
        domain,
        requestBody: purchasedItemsData,
        responseBody: response.responseData,
        statusCode: response.status
      },
      message: EVENT_MESSAGES.WEB_TRACKING_PURCHASED_ITEMS_SUCCESS,
      logLevel: 'INFO'
    })
  } catch (error: any) {
    console.error("Error sending purchased items:", error?.message);

    await sendLogEvent({
      orgId,
      errorMessage: `Error sending purchased items: ${error?.message}`,
      data: {
        domain,
        requestBody: purchasedItemsData,
        responseBody: error,
        statusCode: error?.status ?? 400
      },
      message: EVENT_MESSAGES.WEB_TRACKING_PURCHASED_ITEMS_ERROR,
      logLevel: 'ERROR'
    })

  }
};
