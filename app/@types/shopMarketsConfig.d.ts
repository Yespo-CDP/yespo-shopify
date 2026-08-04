export interface ShopMarketConfig {
  id: string;
  name: string;
  handle: string;
  enabled: boolean;
  countries: string[];
  locales: string[];
  /** locale (BCP 47) → storefront root URL for that locale in this market */
  rootUrls: Record<string, string>;
}

export interface ShopMarketsConfig {
  markets: ShopMarketConfig[];
  countries: string[];
  locales: string[];
}
