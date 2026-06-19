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
 * Temporary stub for the Yespo market products API.
 */
export const updateMarketProducts = async ({
  apiKey,
  items,
  domain,
  orgId,
}: {
  apiKey: string;
  items: MarketProductPayload[];
  domain: string;
  orgId?: number | null;
}): Promise<MarketProductsResponse> => {
  void apiKey;
  void domain;
  void orgId;

  console.log(`[mock] updateMarketProducts: ${items.length} items`);

  return {
    id: Date.now(),
    failedItems: [],
  };
};

/**
 * Temporary stub for the Yespo market translations API.
 */
export const updateMarketTranslations = async ({
  apiKey,
  items,
  domain,
  orgId,
}: {
  apiKey: string;
  items: MarketTranslationPayload[];
  domain: string;
  orgId?: number | null;
}): Promise<MarketProductsResponse> => {
  void apiKey;
  void domain;
  void orgId;

  console.log(`[mock] updateMarketTranslations: ${items.length} items`);

  return {
    id: Date.now(),
    failedItems: [],
  };
};
