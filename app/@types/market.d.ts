export interface Market {
  id: string;
  name: string;
  handle: string;
  enabled?: boolean;
}

export interface MarketResponse {
  markets: {
    nodes: Market[];
  };
}
