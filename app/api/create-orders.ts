import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";
import type { Order, OrdersCreateResponse } from "~/@types/order";
import {sendLogEvent} from "~/api/send-log-event";
import {EVENT_MESSAGES} from "~/config/constants";

/**
 * Sends a POST request to create the orders in the Yespo API.
 *
 * @param {Object} params - The function parameters.
 * @param {string} params.apiKey - The API key used for authentication.
 * @param {Order} params.orders - The orders data array to be created.
 * @returns {Promise<OrdersCreateResponse>} A promise that resolves when the orders is created successfully.
 *
 * @throws Will re-throw errors unless the error message includes 'Duplicated request'.
 *
 * Uses `fetchWithErrorHandling` to perform the HTTP request and handle errors.
 */

export const createOrders = async ({
  apiKey,
  orders,
  domain
}: {
  apiKey: string;
  orders: Order[];
  domain: string;
}): Promise<OrdersCreateResponse> => {
  const url = `${process.env.API_URL}/orders`;
  const authHeader = getAuthHeader(apiKey);
  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ orders }),
  };

  try {
    const response = await fetchWithErrorHandling(url, options);
    return response as OrdersCreateResponse;
  } catch (error: any) {
    console.error("Error creating orders:", error?.message);

    await sendLogEvent({
      errorMessage: `Error creating orders: ${error?.message}`,
      data: JSON.stringify({domain}),
      message: EVENT_MESSAGES.CUSTOM_LOG_CREATE_YESPO_ORDERS_ERROR,
      logLevel: 'ERROR'
    })

    if (!error?.message?.includes("Duplicated request")) {
      throw new Error(error.message);
    } else {
      throw new Error("Error updating contacts");
    }
  }
};
