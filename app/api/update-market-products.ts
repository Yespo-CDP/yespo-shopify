export interface MarketProductPayload {
  productId: string;
  variantId: string;
  countryCode: string;
  pricing: unknown;
  variantUpdatedAt?: string;
}

export interface MarketTranslationPayload {
  productId: string;
  locale: string;
  marketId: string;
  translations: unknown;
  productUpdatedAt?: string;
}

export interface MarketProductsResponse {
  id: number;
  failedItems: string[];
}

/**
 * Temporary stub for the Yespo POST /v1/markets API (pricing + stock per market).
 *
 * TODO: replace with a real HTTP call once MarketProductPayload is mapped to the
 * Yespo market envelope: { siteId, markets: [{ marketId, products: [...] }] }
 * Each product item requires: productId, updatedDate, and at least one of
 * price, currency, isInStock, oldPrice, or urls.
 *
 * @param {Object} params - The input parameters.
 * @param {string} params.apiKey - The API key used for authentication.
 * @param {string} params.siteId - The Yespo site/account identifier.
 * @param {MarketProductPayload[]} params.items - Market product items to sync.
 * @param {string} params.domain - The shop domain for logging.
 * @param {number | null | undefined} params.orgId - The Yespo organization id for logging.
 */
export const updateMarketProducts = async ({
  apiKey,
  siteId,
  items,
  domain,
  orgId,
}: {
  apiKey: string;
  siteId: string;
  items: MarketProductPayload[];
  domain: string;
  orgId?: number | null;
}): Promise<MarketProductsResponse> => {
  // FIXME: Replace with a real HTTP call once MarketProductPayload is mapped to Yespo format:
  // const url = `${process.env.API_URL}/v1/markets`;
  // const authHeader = getAuthHeader(apiKey);
  // const markets = groupByMarketId(items, siteId); // group by countryCode → marketId
  // await fetchWithErrorHandling(url, {
  //   method: "POST",
  //   headers: { "content-type": "application/json", Authorization: authHeader },
  //   body: JSON.stringify({ siteId, markets }),
  // });
  void apiKey;
  void siteId;
  void domain;
  void orgId;

  console.log(`[mock] updateMarketProducts: ${items.length} items`);

  return {
    id: Date.now(),
    failedItems: [],
  };
};

/**
 * Temporary stub for syncing product translations to Yespo.
 *
 * NOTE: In the Yespo API, product translations (name, description per locale)
 * are sent via POST /v1/products using the `translations` field on each product,
 * NOT via /v1/markets. Market-specific locale URLs go into the `urls` field of
 * the /v1/markets product item.
 *
 * TODO: restructure — locale name/description → POST /v1/products translations[];
 *       locale URLs per market → POST /v1/markets products[].urls.
 *
 * @param {Object} params - The input parameters.
 * @param {string} params.apiKey - The API key used for authentication.
 * @param {string} params.siteId - The Yespo site/account identifier.
 * @param {MarketTranslationPayload[]} params.items - Translation items to sync.
 * @param {string} params.domain - The shop domain for logging.
 * @param {number | null | undefined} params.orgId - The Yespo organization id for logging.
 */
export const updateMarketTranslations = async ({
  apiKey,
  siteId,
  items,
  domain,
  orgId,
}: {
  apiKey: string;
  siteId: string;
  items: MarketTranslationPayload[];
  domain: string;
  orgId?: number | null;
}): Promise<MarketProductsResponse> => {
  void apiKey;
  void siteId;
  void domain;
  void orgId;

  console.log(`[mock] updateMarketTranslations: ${items.length} items`);

  return {
    id: Date.now(),
    failedItems: [],
  };
};
