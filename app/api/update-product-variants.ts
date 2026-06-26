import fs from "node:fs";
import path from "node:path";

import type {
  ProductVariant,
  ProductVariantsResponse,
} from "~/@types/productVariant";
import { sendLogEvent } from "~/api/send-log-event";
import { EVENT_MESSAGES } from "~/config/constants";
// import { getAuthHeader } from "~/utils/auth";
// import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";
import { throttleApiRequest } from "~/utils/rate-limiter.server";

/**
 * Returns a shallow copy of a product with the Shopify collection `id` removed
 * from every category — both top-level and inside per-locale translations.
 * Yespo only needs category `name`/`type`, not the Shopify id.
 */
export const stripCategoryIdsFromProduct = (
  product: ProductVariant,
): ProductVariant => {
  const stripId = <T extends { id?: string }>({ id: _id, ...rest }: T) => rest;

  return {
    ...product,
    categories: product.categories?.map(stripId),
    translations: product.translations?.map((translation) =>
      Object.fromEntries(
        Object.entries(translation).map(([locale, value]) => [
          locale,
          value.categories
            ? { ...value, categories: value.categories.map(stripId) }
            : value,
        ]),
      ),
    ),
    // Category ids are intentionally omitted at runtime; the cast keeps the
    // public payload type intact for callers (Yespo simply receives no id).
  } as ProductVariant;
};

/**
 * Sends a batch of product variants to the Yespo POST /v1/products API.
 *
 * languageCode = shop.defaultLanguageCode (Shopify shop.primaryLocale, stored in DB).
 * languageChanged = true only on the first batch when primaryLocale changed vs stored defaultLanguageCode.
 * After the first accepted batch the caller must update shop.defaultLanguageCode in DB.
 *
 * On HTTP 409 LANGUAGE_CODE_MISMATCH the request is retried once with
 * `languageChanged: true`.
 *
 * @param params.apiKey - Basic-auth API key.
 * @param params.siteId - Yespo site/account identifier (required in every request).
 * @param params.languageCode - BCP 47 language tag (e.g. "uk", "en"). Must match shop.primaryLocale.
 * @param params.languageChanged - Set to true on the first batch when the language is changing.
 * @param params.productVariants - Product variant array to sync (max 500 per call).
 * @param params.domain - Shop domain used for logging.
 * @param params.orgId - Yespo organisation id used for logging.
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
  try {
    await throttleApiRequest(siteId);

    const url = `${process.env.API_URL}/products`;
    const requestLanguageChanged = languageChanged;
    const languageChangedConfirmed = languageChanged;

    // Yespo does not need the Shopify collection `id` on categories. We keep it
    // internally (e.g. to resolve collection translations) and strip it here, at
    // the single outbound boundary, for both top-level and per-locale categories.
    const sanitizedProductVariants = productVariants.map(
      stripCategoryIdsFromProduct,
    );

    const buildRequestBody = () => ({
      siteId,
      languageCode,
      languageChanged: requestLanguageChanged,
      products: sanitizedProductVariants,
    });

    const debugDir = path.resolve(process.cwd(), "debug");
    fs.mkdirSync(debugDir, { recursive: true });

    // Persist the exact object that would be sent to Yespo for inspection.
    const requestBody = buildRequestBody();
    fs.writeFileSync(
      path.join(debugDir, `product-variants-${siteId}-${Date.now()}.json`),
      JSON.stringify(requestBody, null, 2),
    );

    // NOTE: The real HTTP call to Yespo is currently stubbed (mirrors the market
    // sync client). The payload written to debug/ above is used for inspection.
    // Uncomment the block below once the Yespo POST /v1/products endpoint is live.
    // const sendRequest = async () => {
    //   return fetchWithErrorHandling(url, {
    //     method: "POST",
    //     headers: {
    //       "content-type": "application/json",
    //       Authorization: getAuthHeader(apiKey),
    //     },
    //     body: JSON.stringify(buildRequestBody()),
    //   });
    // };

    // let response;
    // try {
    //   response = await sendRequest();
    // } catch (error: any) {
    //   if (error?.status === 409 && !requestLanguageChanged) {
    //     await throttleApiRequest(siteId);
    //     requestLanguageChanged = true;
    //     languageChangedConfirmed = true;
    //     response = await sendRequest();
    //   } else {
    //     throw error;
    //   }
    // }

    // const responseData = response.responseData as ProductVariantsResponse;

    // await sendLogEvent({
    //   orgId,
    //   errorMessage: "",
    //   data: JSON.stringify({
    //     domain,
    //     variantsCount: productVariants.length,
    //     variantIds: productVariants.map((variant) => variant.productId),
    //     languageChanged: requestLanguageChanged,
    //   }),
    //   message: EVENT_MESSAGES.CUSTOM_LOG_SEND_PRODUCT_VARIANTS_SUCCESS,
    //   logLevel: "INFO",
    // });

    // return {
    //   ...responseData,
    //   languageChangedConfirmed,
    // };

    void apiKey;
    void url;
    void requestLanguageChanged;

    console.log(
      `[mock] updateProductVariants: ${productVariants.length} product(s) for siteId ${siteId}`,
    );

    return {
      languageChangedConfirmed,
    };
  } catch (error: any) {
    console.error("Error updating product variants:", error?.message);

    await sendLogEvent({
      orgId,
      errorMessage: `Error updating product variants: ${error?.message}`,
      data: JSON.stringify({
        domain,
        variantsCount: productVariants.length,
        responseBody: error,
        statusCode: error?.status ?? 500,
      }),
      message: EVENT_MESSAGES.CUSTOM_LOG_SEND_PRODUCT_VARIANTS_ERROR,
      logLevel: "ERROR",
    });

    throw new Error(error.message);
  }
};
