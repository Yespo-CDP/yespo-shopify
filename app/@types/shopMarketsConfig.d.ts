export interface ShopMarketConfig {
  id: string;
  name: string;
  handle: string;
  enabled: boolean;
  countries: string[];
  locales: string[];
}

export interface ShopMarketsConfig {
  markets: ShopMarketConfig[];
  countries: string[];
  locales: string[];
}
