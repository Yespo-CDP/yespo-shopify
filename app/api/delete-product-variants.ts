import fs from "node:fs";
import path from "node:path";

import { sendLogEvent } from "~/api/send-log-event";
import { EVENT_MESSAGES } from "~/config/constants";
import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";
import { throttleApiRequest } from "~/utils/rate-limiter.server";

/**
 * Sends a DELETE request to Yespo DELETE /v1/products for the given variant IDs.
 *
 * Each item requires productId (Shopify variant GID) and updatedDate (current UTC timestamp).
 * Respects the 60 req/min per siteId rate limit.
 *
 * @param params.apiKey - Basic-auth API key.
 * @param params.siteId - Yespo site/account identifier.
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

  try {
    await throttleApiRequest(siteId);

    const deletedAt = new Date().toISOString();

    const requestBody = {
      siteId,
      products: externalVariantIds.map((productId) => ({
        productId,
        updatedDate: deletedAt,
      })),
    };
    const debugDir = path.resolve(process.cwd(), "debug");
    fs.mkdirSync(debugDir, { recursive: true });
    fs.writeFileSync(
      path.join(debugDir, `product-delete-${siteId}-${Date.now()}.json`),
      JSON.stringify(requestBody, null, 2),
    );

    const url = `${process.env.API_URL}/products`;
    await fetchWithErrorHandling(url, {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        Authorization: getAuthHeader(apiKey),
      },
      body: JSON.stringify(requestBody),
    });

    await sendLogEvent({
      orgId,
      errorMessage: "",
      data: JSON.stringify({
        domain,
        deletedCount: externalVariantIds.length,
        statusCode: 200,
      }),
      message: EVENT_MESSAGES.CUSTOM_LOG_SEND_PRODUCT_VARIANTS_SUCCESS,
      logLevel: "INFO",
    });
  } catch (error: any) {
    console.error("Error deleting product variants:", error?.message);

    await sendLogEvent({
      orgId,
      errorMessage: `Error deleting product variants: ${error?.message}`,
      data: JSON.stringify({
        domain,
        deletedCount: externalVariantIds.length,
        responseBody: error,
        statusCode: error?.status ?? 500,
      }),
      message: EVENT_MESSAGES.CUSTOM_LOG_SEND_PRODUCT_VARIANTS_ERROR,
      logLevel: "ERROR",
    });

    throw new Error(error.message);
  }
};
