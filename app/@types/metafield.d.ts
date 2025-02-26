export type MetafieldOwnerType = "MARKET" | "PRODUCT" | "SHOP" | "ORDER";

export type MetafieldType = "boolean" | "json" | "single_line_text_field";

export interface Metafield {
  id: string;
  key: string;
  namespace: string;
  type: MetafieldType;
  ownerType: MetafieldOwnerType;
  value: any;
}

export interface MetafieldResponse {
  shop: {
    metafield: Metafield;
  };
}
