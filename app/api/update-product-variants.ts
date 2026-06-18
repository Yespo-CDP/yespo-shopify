import type {
  ProductVariant,
  ProductVariantsResponse,
} from "~/@types/productVariant";
import { sendLogEvent } from "~/api/send-log-event";
import { EVENT_MESSAGES } from "~/config/constants";

/**
 * Temporary stub for the Yespo product variants API.
 *
 * Replace with a real HTTP call to `${process.env.API_URL}/product-variants` once the Yespo endpoint is available.
 * When implementing, replace EVENT_MESSAGES.CUSTOM_LOG_SEND_PRODUCT_VARIANTS_SUCCESS / CUSTOM_LOG_SEND_PRODUCT_VARIANTS_ERROR
 * with the real Yespo product variants API messages.
 *
 * @param {Object} params - The input parameters.
 * @param {string} params.apiKey - The API key used for authentication.
 * @param {ProductVariant[]} params.productVariants - The product variant array to sync.
 * @param {string} params.domain - The shop domain for logging.
 * @param {number | null | undefined} params.orgId - The Yespo organization id for logging.
 * @returns {Promise<ProductVariantsResponse>} A promise that resolves with a mock success response.
 */
export const updateProductVariants = async ({
  apiKey,
  productVariants,
  domain,
  orgId,
}: {
  apiKey: string;
  productVariants: ProductVariant[];
  domain: string;
  orgId?: number | null;
}): Promise<ProductVariantsResponse> => {
  void apiKey;

  const mockResponse: ProductVariantsResponse = {
    id: Date.now(),
    failedVariants: [],
  };

  try {
    // FIXME: Replace with a real HTTP call once the Yespo endpoint is available:
    // const url = `${process.env.API_URL}/product-variants`;
    // const authHeader = getAuthHeader(apiKey);
    // const response = await fetchWithErrorHandling(url, {
    //   method: "POST",
    //   headers: { "content-type": "application/json", Authorization: authHeader },
    //   body: JSON.stringify({ productVariants }),
    // });
    // return response.responseData as ProductVariantsResponse;

    await sendLogEvent({
      orgId,
      errorMessage: "",
      data: JSON.stringify({
        domain,
        variantsCount: productVariants.length,
        responseBody: mockResponse,
        statusCode: 200,
      }),
      message: EVENT_MESSAGES.CUSTOM_LOG_SEND_PRODUCT_VARIANTS_SUCCESS,
      logLevel: "INFO",
    });

    return mockResponse;
  } catch (error: any) {
    console.error("Error updating product variants:", error?.message);

    await sendLogEvent({
      orgId,
      errorMessage: `Error updating product variants: ${error?.message}`,
      data: JSON.stringify({
        domain,
        requestBody: productVariants.length,
        responseBody: error,
        statusCode: error?.status ?? 500,
      }),
      message: EVENT_MESSAGES.CUSTOM_LOG_SEND_PRODUCT_VARIANTS_ERROR,
      logLevel: "ERROR",
    });

    throw new Error(error.message);
  }
};
