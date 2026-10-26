import { sendLogEvent } from "~/api/send-log-event";
import { EVENT_MESSAGES } from "~/config/constants";
import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";
import { normalizeYespoItems } from "~/utils/normalize-yespo-items";
import { throttleApiRequest } from "~/utils/rate-limiter.server";

/**
 * A single market product item, as defined by the Yespo POST /v1/markets API.
 *
 * `productId` and `updatedDate` are always required; every item must also carry
 * at least one market field to change (price, currency, isInStock, oldPrice).
 */
export interface MarketProductItem {
  productId: string;
  updatedDate: string;
  price?: number;
  /** Pass `null` to explicitly clear a previously set oldPrice in Yespo. */
  oldPrice?: number | null;
  currency?: string;
  isInStock?: 0 | 1;
  /** Pass `null` to clear all URLs; locale keys with `null` clear that locale only. */
  urls?: Record<string, string | null> | null;
}

/**
 * One market envelope entry: a marketId plus the products it applies to.
 */
export interface MarketEnvelope {
  marketId: string;
  products: MarketProductItem[];
}

export interface MarketProductsResponse {
  id: number;
  /** productIds that failed synchronous validation/enqueue. */
  failedItems: string[];
}

/**
 * One entry of the Yespo `items` array, as returned by POST /v1/markets.
 * `status` is per-item: `"accepted"` or `"rejected"`.
 */
interface YespoMarketResultItem {
  marketId?: string;
  productId: string;
  status: "accepted" | "rejected";
  code?: string;
  message?: string;
}

/**
 * Raw response body of the Yespo POST /v1/markets endpoint.
 * `failedItems` is not a Yespo field — we derive it from `items`.
 */
interface YespoMarketsRawResponse {
  requestId: string;
  summary: { received: number; accepted: number; rejected: number };
  /** Jackson emits a single object when the list has one element. */
  items: YespoMarketResultItem | YespoMarketResultItem[];
}

/**
 * Derives the list of failed `productId`s from a raw Yespo markets response by
 * collecting every item whose per-item `status` is `"rejected"`.
 */
function deriveFailedItems(response: YespoMarketsRawResponse): string[] {
  return normalizeYespoItems(response.items)
    .filter((item) => item.status === "rejected")
    .map((item) => item.productId);
}

/**
 * Sends market-specific prices, stock, and (optionally) URLs to the Yespo
 * POST /v1/markets API.
 *
 * Envelope: { markets: [{ marketId, products: [...] }] }
 *
 * @param params.apiKey - Basic-auth API key. The Yespo site is resolved from the key, not the body.
 * @param params.siteId - Yespo site/account identifier; used for rate limiting, not sent in the body.
 * @param params.markets - Markets to sync, already grouped by marketId.
 * @param params.domain - Shop domain used for logging.
 * @param params.orgId - Yespo organisation id used for logging.
 */
export const updateMarketProducts = async ({
  apiKey,
  siteId,
  markets,
  domain,
  orgId,
}: {
  apiKey: string;
  siteId: string;
  markets: MarketEnvelope[];
  domain: string;
  orgId?: number | null;
}): Promise<MarketProductsResponse> => {
  const itemCount = markets.reduce(
    (sum, market) => sum + market.products.length,
    0,
  );

  // Yespo expects marketId (country code) in lowercase, while Shopify supplies
  // it as an uppercase ISO code. Normalise here, at the single outbound boundary,
  // so every caller stays consistent without touching Shopify enums or DB keys.
  const normalizedMarkets = markets.map((market) => ({
    ...market,
    marketId: market.marketId.toLowerCase(),
  }));

  try {
    await throttleApiRequest(siteId);

    const requestBody = { markets: normalizedMarkets };
    const url = `${process.env.API_URL}/markets`;

    console.log(
      `POST /v1/markets ${domain}: ${itemCount} item(s), markets ${normalizedMarkets.map((market) => market.marketId).join(", ")}`,
    );
    console.log(JSON.stringify(requestBody, null, 2));

    const response = await fetchWithErrorHandling(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: getAuthHeader(apiKey),
      },
      body: JSON.stringify(requestBody),
    });

    // Yespo returns { requestId, summary, items }, where each item carries a
    // per-item status. failedItems is derived from items with status "rejected".
    const responseData = response.responseData as YespoMarketsRawResponse;
    const rejectedItems = normalizeYespoItems(responseData.items).filter(
      (item) => item.status === "rejected",
    );
    const failedItems = deriveFailedItems(responseData);

    console.log(
      `POST /v1/markets ${domain} response:`,
      JSON.stringify(responseData, null, 2),
    );

    if (rejectedItems.length > 0) {
      console.warn(
        `Yespo rejected ${rejectedItems.length} market item(s):`,
        JSON.stringify(rejectedItems, null, 2),
      );
    }

    await sendLogEvent({
      orgId,
      errorMessage: "",
      data: {
        domain,
        itemCount,
        marketIds: normalizedMarkets.map((market) => market.marketId),
        requestBody,
        responseBody: responseData,
        statusCode: response.status,
      },
      message: EVENT_MESSAGES.CUSTOM_LOG_SEND_MARKET_PRODUCTS_SUCCESS,
      logLevel: "INFO",
    });

    return { id: Date.now(), failedItems };
  } catch (error: any) {
    console.error("Error updating market products:", error?.message);

    await sendLogEvent({
      orgId,
      errorMessage: `Error updating market products: ${error?.message}`,
      data: {
        domain,
        itemCount,
        marketIds: normalizedMarkets.map((market) => market.marketId),
        requestBody: { markets: normalizedMarkets },
        responseBody: error?.responseData ?? error?.message,
        statusCode: error?.status ?? 500,
      },
      message: EVENT_MESSAGES.CUSTOM_LOG_SEND_MARKET_PRODUCTS_ERROR,
      logLevel: "ERROR",
    });

    throw error;
  }
};
