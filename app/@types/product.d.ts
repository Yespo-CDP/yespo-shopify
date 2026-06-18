export interface ProductVariantData {
  id: string;
  title: string;
  price: string;
  contextualPricing?: {
    price?: {
      amount: string;
      currencyCode: string;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface ProductData {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  variants: {
    nodes: ProductVariantData[];
    pageInfo: {
      endCursor?: string;
      hasNextPage: boolean;
    };
  };
}

export interface ProductsResponse {
  shop?: {
    currencyCode?: string;
  };
  products: {
    nodes: ProductData[];
    pageInfo: {
      endCursor?: string;
      hasNextPage: boolean;
    };
  };
}

export interface ProductVariantsResponse {
  product: {
    variants: {
      nodes: ProductVariantData[];
      pageInfo: {
        endCursor?: string;
        hasNextPage: boolean;
      };
    };
  } | null;
}
