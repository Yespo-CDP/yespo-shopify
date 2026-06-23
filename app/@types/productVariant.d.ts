export interface YespoCategory {
  id: string;
  name: string;
  path?: string[];
  type?: "category" | "collection";
}

/**
 * Explicit remove instructions for update operations.
 * Null is NOT used for clearing in Yespo — use this object instead.
 *
 * Basic (implemented): `fields` — clears scalar optional fields.
 * Full (TODO): `tags` — removes specific tag keys; `translations` — removes specific locales.
 */
export interface ProductRemovePatch {
  fields?: Array<"oldPrice" | "description" | "brand" | "itemGroupId" | "translations">;
  tags?: string[];
  translations?: string[];
}

export interface ProductVariant {
  action: "create" | "update";
  productId: string;
  updatedDate: string;
  name: string;
  imageUrl: string;
  url: string;
  isInStock: 0 | 1;
  price: number;
  currency: string;
  categories: YespoCategory[];
  itemGroupId?: string;
  oldPrice?: number;
  brand?: string;
  description?: string;
  tags?: Record<string, string[]>;
  translations?: Array<Record<string, { name?: string; url?: string; description?: string; categories?: Array<{ id: string; name: string; type?: "category" | "collection" }> }>>;
  remove?: ProductRemovePatch;
}

export interface ProductVariantsResponse {
  failedVariants?: object | object[];
  asyncSessionId?: string;
  id?: number;
}
