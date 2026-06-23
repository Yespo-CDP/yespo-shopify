import fs from "node:fs";
import path from "node:path";

import { sendLogEvent } from "~/api/send-log-event";
import { EVENT_MESSAGES } from "~/config/constants";
import { throttleApiRequest } from "~/utils/rate-limiter.server";
// import { getAuthHeader } from "~/utils/auth";
// import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";

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
  oldPrice?: number;
  currency?: string;
  isInStock?: 0 | 1;
  urls?: Record<string, string>;
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
 * Sends market-specific prices, stock, and (optionally) URLs to the Yespo
 * POST /v1/markets API.
 *
 * Envelope: { siteId, markets: [{ marketId, products: [...] }] }
 *
 * NOTE: The HTTP call is currently stubbed (mirrors the product sync client) and
 * returns a mock success response. The exact payload that would be sent is
 * written to `debug/` for inspection. Uncomment the block below once the Yespo
 * endpoint is live.
 *
 * @param params.apiKey - Basic-auth API key.
 * @param params.siteId - Yespo site/account identifier (required in every request).
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

  try {
    await throttleApiRequest(siteId);

    const requestBody = { siteId, markets };

    // Persist the exact object that would be sent to Yespo for inspection.
    const debugDir = path.resolve(process.cwd(), "debug");
    fs.mkdirSync(debugDir, { recursive: true });
    const marketIds = markets.map((market) => market.marketId).join("-");
    fs.writeFileSync(
      path.join(debugDir, `market-sync-${marketIds}-${Date.now()}.json`),
      JSON.stringify(requestBody, null, 2),
    );

    const url = `${process.env.API_URL}/markets`;
    // const response = await fetchWithErrorHandling(url, {
    //   method: "POST",
    //   headers: {
    //     "content-type": "application/json",
    //     Authorization: getAuthHeader(apiKey),
    //   },
    //   body: JSON.stringify(requestBody),
    // });

    // const responseData = response.responseData as MarketProductsResponse;

    // await sendLogEvent({
    //   orgId,
    //   errorMessage: "",
    //   data: JSON.stringify({
    //     domain,
    //     itemCount,
    //     marketIds: markets.map((market) => market.marketId),
    //   }),
    //   message: EVENT_MESSAGES.CUSTOM_LOG_SEND_MARKET_PRODUCTS_SUCCESS,
    //   logLevel: "INFO",
    // });

    // return responseData;

    void apiKey;
    void url;

    console.log(
      `[mock] updateMarketProducts: ${itemCount} items across ${markets.length} market(s)`,
    );

    return {
      id: Date.now(),
      failedItems: [],
    };
  } catch (error: any) {
    console.error("Error updating market products:", error?.message);

    await sendLogEvent({
      orgId,
      errorMessage: `Error updating market products: ${error?.message}`,
      data: JSON.stringify({
        domain,
        itemCount,
        responseBody: error,
        statusCode: error?.status ?? 500,
      }),
      message: EVENT_MESSAGES.CUSTOM_LOG_SEND_MARKET_PRODUCTS_ERROR,
      logLevel: "ERROR",
    });

    throw new Error(error.message);
  }
};
