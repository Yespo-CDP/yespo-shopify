export interface ProductVariantData {
  id: string;
  title: string;
  price: string;
  compareAtPrice?: string | null;
  inventoryQuantity: number;
  image?: { url: string } | null;
  contextualPricing?: {
    price?: {
      amount: string;
      currencyCode: string;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface ProductTranslationCategory {
  id: string;
  name: string;
  type?: "category" | "collection";
}

export interface ProductTranslation {
  name?: string;
  description?: string;
  url?: string;
  categories?: ProductTranslationCategory[];
}

export interface ProductData {
  id: string;
  title: string;
  handle: string;
  description: string;
  vendor: string;
  tags: string[];
  onlineStoreUrl?: string | null;
  featuredImage?: { url: string } | null;
  collections?: {
    nodes: Array<{ id: string; title: string; handle: string }>;
  };
  /** locale → ProductTranslation (product-level) */
  translations?: Record<string, ProductTranslation>;
  /** strippedVariantId → locale → translated variant title */
  variantTranslations?: Record<string, Record<string, string>>;
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
