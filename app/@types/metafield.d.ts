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

export interface MetafieldDefinition {
  id: string;
  name: string;
  description: string;
  key: string;
  namespace: string;
  ownerType: MetafieldOwnerType;
  type: { name: MetafieldType };
  access: { admin: string; storefront: string };
}

export interface MetafieldResponse {
  shop: {
    metafield: Metafield;
  };
}
