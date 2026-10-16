import { sendLogEvent } from "~/api/send-log-event";
import { EVENT_MESSAGES } from "~/config/constants";
import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";
import { throttleApiRequest } from "~/utils/rate-limiter.server";

/**
 * Sends a DELETE request to Yespo DELETE /v1/products for the given variant IDs.
 *
 * Each item requires productId (numeric Shopify variant ID) and updatedDate
 * (current UTC timestamp). Respects the 60 req/min per siteId rate limit.
 *
 * @param params.apiKey - Basic-auth API key. The Yespo site is resolved from the key, not the body.
 * @param params.siteId - Yespo site/account identifier; used for rate limiting, not sent in the body.
 * @param params.externalVariantIds - Shopify variant IDs to delete (max 500 per call).
 * @param params.domain - Shop domain used for logging.
 * @param params.orgId - Yespo organisation id used for logging.
 */
export const deleteProductVariants = async ({
  apiKey,
  siteId,
  externalVariantIds,
  domain,
  orgId,
}: {
  apiKey: string;
  siteId: string;
  externalVariantIds: string[];
  domain: string;
  orgId?: number | null;
}): Promise<void> => {
  if (externalVariantIds.length === 0) return;

  const logData = (responseBody: unknown, statusCode: number) => ({
    domain,
    productsCount: externalVariantIds.length,
    productIds: externalVariantIds,
    responseBody: responseBody ?? null,
    statusCode,
  });

  try {
    await throttleApiRequest(siteId);

    const deletedAt = new Date().toISOString();
    const requestBody = {
      products: externalVariantIds.map((productId) => ({
        productId,
        updatedDate: deletedAt,
      })),
    };

    const url = `${process.env.API_URL}/products`;

    const response = await fetchWithErrorHandling(
      url,
      {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          Authorization: getAuthHeader(apiKey),
        },
        body: JSON.stringify(requestBody),
      },
    );

    await sendLogEvent({
      orgId,
      errorMessage: "",
      data: logData(response.responseData, response.status),
      message: EVENT_MESSAGES.DELETE_PRODUCTS_BULK_SUCCESS,
      logLevel: "INFO",
    });
  } catch (error: any) {
    console.error("Error deleting product variants:", error?.message);

    await sendLogEvent({
      orgId,
      errorMessage: `Error deleting product variants: ${error?.message}`,
      data: logData(error?.responseData, error?.status ?? 500),
      message: EVENT_MESSAGES.DELETE_PRODUCTS_BULK_FAILED,
      logLevel: "ERROR",
    });

    throw new Error(error.message);
  }
};
