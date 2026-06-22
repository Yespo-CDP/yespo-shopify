import type {
  ProductVariant,
  ProductVariantsResponse,
} from "~/@types/productVariant";
import { sendLogEvent } from "~/api/send-log-event";
import { EVENT_MESSAGES } from "~/config/constants";

/**
 * Temporary stub for the Yespo POST /v1/products API.
 *
 * Replace with a real HTTP call once the payload builders are updated to produce
 * the full Yespo product envelope (action, updatedDate, imageUrl, url, isInStock,
 * categories, translations, etc.).
 *
 * languageCode = shop.defaultLanguageCode (Shopify shop.primaryLocale, stored in DB).
 * languageChanged = true only on the first batch when primaryLocale changed vs stored defaultLanguageCode.
 * After the first accepted batch the caller must update shop.defaultLanguageCode in DB.
 *
 * @param {Object} params - The input parameters.
 * @param {string} params.apiKey - The API key used for authentication.
 * @param {string} params.siteId - The Yespo site/account identifier.
 * @param {string} params.languageCode - BCP 47 language tag (e.g. "uk", "en"). Must match shop.primaryLocale.
 * @param {boolean} [params.languageChanged] - Set to true on the first batch when the language is changing.
 * @param {ProductVariant[]} params.productVariants - The product variant array to sync.
 * @param {string} params.domain - The shop domain for logging.
 * @param {number | null | undefined} params.orgId - The Yespo organization id for logging.
 * @returns {Promise<ProductVariantsResponse>} A promise that resolves with a mock success response.
 */
export const updateProductVariants = async ({
  apiKey,
  siteId,
  languageCode,
  languageChanged = false,
  productVariants,
  domain,
  orgId,
}: {
  apiKey: string;
  siteId: string;
  languageCode: string;
  languageChanged?: boolean;
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
    // FIXME: Replace with a real HTTP call once product payload builders produce the full Yespo format:
    // const url = `${process.env.API_URL}/v1/products`;
    // const authHeader = getAuthHeader(apiKey);
    // const response = await fetchWithErrorHandling(url, {
    //   method: "POST",
    //   headers: { "content-type": "application/json", Authorization: authHeader },
    //   body: JSON.stringify({
    //     siteId,
    //     languageCode,
    //     languageChanged,
    //     products: productVariants,
    //   }),
    // });
    // return response.responseData as ProductVariantsResponse;
    void siteId;
    void languageCode;
    void languageChanged;

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
