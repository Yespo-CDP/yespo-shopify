import type {
  ProductVariant,
  ProductVariantsResponse,
} from "~/@types/productVariant";
import { sendLogEvent } from "~/api/send-log-event";
import { EVENT_MESSAGES } from "~/config/constants";
import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";
import { throttleApiRequest } from "~/utils/rate-limiter.server";

/**
 * One entry of the Yespo `items` array, as returned by POST /v1/products.
 * `status` is per-item: `"accepted"` or `"rejected"`.
 */
interface YespoProductResultItem {
  productId: string;
  action?: string;
  status: "accepted" | "rejected";
  code?: string;
  message?: string;
}

/**
 * Raw response body of the Yespo POST /v1/products endpoint.
 * `failedVariants` is not a Yespo field — we derive it from `items`.
 */
interface YespoProductsRawResponse {
  requestId: string;
  summary: { received: number; accepted: number; rejected: number };
  items: YespoProductResultItem[];
}

/**
 * Collects every item whose per-item `status` is `"rejected"`, used to populate
 * the `failedVariants` field consumed by the product sync handler.
 */
function deriveFailedVariants(
  response: YespoProductsRawResponse,
): YespoProductResultItem[] {
  return (response.items ?? []).filter((item) => item.status === "rejected");
}

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
 * languageCode = Shopify shop.primaryLocale (also cached as shop.defaultLanguageCode).
 *
 * @param params.apiKey - Basic-auth API key. The Yespo site is resolved from the key, not the body.
 * @param params.siteId - Yespo site/account identifier; used for rate limiting, not sent in the body.
 * @param params.languageCode - BCP 47 language tag (e.g. "uk", "en"). Must match shop.primaryLocale.
 * @param params.productVariants - Product variant array to sync (max 500 per call).
 * @param params.domain - Shop domain used for logging.
 * @param params.orgId - Yespo organisation id used for logging.
 */
export const updateProductVariants = async ({
  apiKey,
  siteId,
  languageCode,
  productVariants,
  domain,
  orgId,
}: {
  apiKey: string;
  siteId: string;
  languageCode: string;
  productVariants: ProductVariant[];
  domain: string;
  orgId?: number | null;
}): Promise<ProductVariantsResponse> => {
  try {
    await throttleApiRequest(siteId);

    const url = `${process.env.API_URL}/products`;

    // Yespo does not need the Shopify collection `id` on categories. We keep it
    // internally (e.g. to resolve collection translations) and strip it here, at
    // the single outbound boundary, for both top-level and per-locale categories.
    const sanitizedProductVariants = productVariants.map(
      stripCategoryIdsFromProduct,
    );

    const response = await fetchWithErrorHandling(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: getAuthHeader(apiKey),
      },
      body: JSON.stringify({
        languageCode,
        products: sanitizedProductVariants,
      }),
    });

    // Yespo returns { requestId, summary, items }, where each item carries a
    // per-item status. failedVariants is derived from items with status "rejected".
    const responseData = response.responseData as YespoProductsRawResponse;
    const failedVariants = deriveFailedVariants(responseData);

    if (failedVariants.length > 0) {
      console.warn(
        `Yespo rejected ${failedVariants.length} product(s):`,
        JSON.stringify(failedVariants, null, 2),
      );
    }

    await sendLogEvent({
      orgId,
      errorMessage: "",
      data: JSON.stringify({
        domain,
        variantsCount: productVariants.length,
        variantIds: productVariants.map((variant) => variant.productId),
        accepted: responseData.summary?.accepted,
        rejected: responseData.summary?.rejected,
      }),
      message: EVENT_MESSAGES.CUSTOM_LOG_SEND_PRODUCT_VARIANTS_SUCCESS,
      logLevel: "INFO",
    });

    return { failedVariants };
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
