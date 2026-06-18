export interface ProductVariant {
  externalVariantId: string;
  externalProductId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
}

export interface ProductVariantsResponse {
  failedVariants?: object | object[];
  asyncSessionId?: string;
  id?: number;
}
