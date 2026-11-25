import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";
import { sendLogEvent } from "~/api/send-log-event";
import { EVENT_MESSAGES } from "~/config/constants";

/**
 * Deletes one order in Yespo by its external order ID (`DELETE /orders`, removeHistoryOrders).
 *
 * Yespo only accepts the job (HTTP 200, logged as success) and deletes the order asynchronously.
 * On HTTP 400 (invalid request) the error is logged and not retried. Any other
 * error is logged and rethrown so the webhook job is retried.
 *
 * @param {Object} params - The parameters object.
 * @param {string} params.apiKey - The API key used for authentication.
 * @param {string} params.externalOrderId - Shopify order ID the order was sent to Yespo with.
 * @param {string} params.domain - Shop domain for the log event.
 * @param {number | null} [params.orgId] - Yespo organisation ID for the log event.
 * @returns {Promise<void>} Resolves when Yespo accepted the deletion or rejected it with HTTP 400.
 */
export const deleteYespoOrder = async ({
  apiKey,
  externalOrderId,
  domain,
  orgId,
}: {
  apiKey: string;
  externalOrderId: string;
  domain: string;
  orgId?: number | null;
}): Promise<void> => {
  const url = `${process.env.API_URL}/orders?${new URLSearchParams({ externalOrderId })}`;

  try {
    const response = await fetchWithErrorHandling(url, {
      method: "DELETE",
      headers: { Authorization: getAuthHeader(apiKey) },
    });

    await sendLogEvent({
      orgId,
      errorMessage: "",
      data: {
        domain,
        requestBody: { externalOrderId },
        responseBody: response.responseData,
        statusCode: response.status,
      },
      message: EVENT_MESSAGES.CUSTOM_LOG_DELETE_YESPO_ORDERS_SUCCESS,
      logLevel: "INFO",
    });
  } catch (error) {
    const { message, status } = error as { message?: string; status?: number };
    console.error(`Error deleting order ${externalOrderId}:`, message);
    await sendLogEvent({
      orgId,
      errorMessage: `Error deleting order ${externalOrderId}: ${message}`,
      data: {
        domain,
        requestBody: { externalOrderId },
        responseBody: error,
        statusCode: status ?? 500,
      },
      message: EVENT_MESSAGES.CUSTOM_LOG_DELETE_YESPO_ORDERS_ERROR,
      logLevel: "ERROR",
    });
    if (status === 400) return;
    throw error;
  }
};
