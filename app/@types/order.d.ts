export interface Order {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  externalOrderId: string;
  externalCustomerId: string;
  totalCost: number;
  taxes?: number;
  shipping?: number;
  discount?: number;
  currency: string;
  date: string;
  status:
    | "INITIALIZED"
    | "IN_PROGRESS"
    | "DELIVERED"
    | "CANCELLED"
    | "ABANDONED_SHOPPING_CART";
  deliveryAddress?: string;
  items: {
    externalItemId: string;
    name: string;
    quantity: number;
    cost: number;
  }[];
}

export type OrderDisplayFulfillmentStatus =
  | "FULFILLED"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "OPEN"
  | "PARTIALLY_FULFILLED"
  | "PENDING_FULFILLMENT"
  | "REQUEST_DECLINED"
  | "RESTOCKED"
  | "SCHEDULED"
  | "UNFULFILLED";

export interface OrderData {
  id: string;
  email?: string | null;
  phone?: string | null;
  currencyCode: string;
  displayFulfillmentStatus: OrderDisplayFulfillmentStatus;
  totalPriceSet?: {
    shopMoney: {
      amount: string;
      currencyCode: string;
    };
  };
  totalTaxSet?: {
    shopMoney: {
      amount: string;
      currencyCode: string;
    };
  };
  totalShippingPriceSet?: {
    shopMoney: {
      amount: string;
      currencyCode: string;
    };
  };
  totalDiscountsSet?: {
    shopMoney: {
      amount: string;
      currencyCode: string;
    };
  };
  shippingAddress?: {
    id: string;
    firstName?: string;
    lastName?: string;
    address1?: string;
    address2?: string;
    city?: string;
    province?: string;
    country?: string;
    zip?: string;
    phone?: string;
    provinceCode?: string;
    countryCodeV2?: string;
  };
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    defaultEmailAddress?: {
      emailAddress: string;
    };
    defaultPhoneNumber?: {
      phoneNumber: string;
    };
    defaultAddress?: {
      id: string;
      address1?: string;
      address2?: string;
      city?: string;
      province?: string;
      country?: string;
      zip?: string;
      phone?: string;
      provinceCode?: string;
      countryCodeV2?: string;
    };
  };
  lineItems: {
    nodes: {
      id: string;
      name: string;
      quantity: number;
      originalTotalSet?: {
        shopMoney: {
          amount: string;
          currencyCode: string;
        };
      };
    }[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface OrdersResponse {
  orders: {
    nodes: OrderData[];
    pageInfo: {
      startCursor?: string;
      endCursor?: string;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
}

export interface OrdersCreateResponse {
  failedOrders?: object | object[];
  asyncSessionId?: string;
  id?: number;
}

export interface OrderCreatePayload {
  id: number;
  admin_graphql_api_id: string;
  cancel_reason: string | null;
  cancelled_at: Date | null;
  closed_at: Date | null;
  confirmation_number: number | null;
  confirmed: boolean;
  contact_email: string;
  created_at: string;
  currency: string;
  current_shipping_price_set?: {
    shop_money: {
      amount: string;
      currency_code: string;
    };
    presentment_money?: {
      amount: string;
      currency_code: string;
    };
  };
  current_subtotal_price: string;
  current_subtotal_price_set?: {
    shop_money: {
      amount: string;
      currency_code: string;
    };
    presentment_money: {
      amount: string;
      currency_code: string;
    };
  };
  current_total_additional_fees_set: any;
  current_total_discounts: string | null;
  current_total_discounts_set?: {
    shop_money: {
      amount: string;
      currency_code: string;
    };
    presentment_money: {
      amount: string;
      currency_code: string;
    };
  };
  current_total_duties_set: any;
  current_total_price: string;
  current_total_price_set?: {
    shop_money: {
      amount: string;
      currency_code: string;
    };
    presentment_money: {
      amount: string;
      currency_code: string;
    };
  };
  current_total_tax: string;
  current_total_tax_set?: {
    shop_money: {
      amount: string;
      currency_code: string;
    };
    presentment_money: {
      amount: string;
      currency_code: string;
    };
  };
  customer_locale: string;
  discount_codes: [];
  email: string;
  name: string;
  note: string | null;
  note_attributes: any[];
  number: number;
  order_number: number;
  order_status_url: string;
  original_total_additional_fees_set: any;
  original_total_duties_set: any;
  payment_gateway_names: string[];
  phone: string | null;
  po_number: number | null;
  presentment_currency: string;
  processed_at: Date | null;
  reference: string | null;
  referring_site: string | null;
  source_identifier: string | null;
  source_name: string;
  source_url: string | null;
  subtotal_price: string;
  subtotal_price_set: {
    shop_money: {
      amount: string;
      currency_code: string;
    };
    presentment_money: {
      amount: string;
      currency_code: string;
    };
  };
  tags: string;
  tax_exempt: boolean;
  tax_lines: any[];
  taxes_included: boolean;
  test: boolean;
  token: string;
  total_discounts: string;
  total_discounts_set?: {
    shop_money: {
      amount: string;
      currency_code: string;
    };
    presentment_money: {
      amount: string;
      currency_code: string;
    };
  };
  total_line_items_price: string;
  total_line_items_price_set?: {
    shop_money: {
      amount: string;
      currency_code: string;
    };
    presentment_money: {
      amount: string;
      currency_code: string;
    };
  };
  total_outstanding: string;
  total_price: string;
  total_price_set?: {
    shop_money: {
      amount: string;
      currency_code: string;
    };
    presentment_money: {
      amount: string;
      currency_code: string;
    };
  };
  total_shipping_price_set?: {
    shop_money: {
      amount: string;
      currency_code: string;
    };
    presentment_money: {
      amount: string;
      currency_code: string;
    };
  };
  total_tax: string;
  total_tax_set?: {
    shop_money: {
      amount: string;
      currency_code: string;
    };
    presentment_money: {
      amount: string;
      currency_code: string;
    };
  };
  total_weight: number;
  updated_at: Date;
  user_id: null;
  billing_address: {
    first_name: string;
    address1: string;
    phone: string;
    city: string;
    zip: string;
    province: string;
    country: string;
    last_name: string;
    address2: string | null;
    company: string;
    name: string;
    country_code: string;
    province_code: string;
  };
  customer: {
    id: number;
    created_at: Date | null;
    updated_at: Date | null;
    first_name: string;
    last_name: string;
    state: string;
    note: string | null;
    verified_email: boolean;
    email: string;
    phone: string | null;
    currency: string;
    tax_exemptions: any[];
    admin_graphql_api_id: string;
    default_address?: {
      id: number;
      customer_id: number;
      first_name: string;
      last_name: string;
      company: string | null;
      address1: string;
      address2: string | null;
      city: string;
      province: string;
      country: string;
      zip: string;
      phone: string;
      name: string;
      province_code: string;
      country_code: string;
      country_name: string;
      default: boolean;
    };
  };
  discount_applications: any[];
  fulfillment_status: "fulfilled" | "partial" | "restocked" | null;
  fulfillments: any[];
  line_items: {
    id: number;
    admin_graphql_api_id: string;
    attributed_staffs: any[];
    current_quantity: number;
    fulfillable_quantity: number;
    fulfillment_service: string;
    fulfillment_status: string | null;
    gift_card: boolean;
    grams: number;
    name: string;
    price: string;
    price_set?: {
      shop_money: {
        amount: string;
        currency_code: string;
      };
      presentment_money: {
        amount: string;
        currency_code: string;
      };
    };
    product_exists: boolean;
    product_id: number;
    properties: any[];
    quantity: number;
    requires_shipping: boolean;
    sales_line_item_group_id: number;
    sku: string;
    taxable: boolean;
    title: string;
    total_discount: string;
    total_discount_set?: {
      shop_money: {
        amount: string;
        currency_code: string;
      };
      presentment_money: {
        amount: string;
        currency_code: string;
      };
    };
  }[];
  shipping_address: {
    first_name: string;
    address1: string;
    phone: string;
    city: string;
    zip: string;
    province: string;
    country: string;
    last_name: string;
    address2: string | null;
    company: string;
    name: string;
    country_code: string;
    province_code: string;
  };
  shipping_lines: {
    id: number;
    carrier_identifier: string | null;
    code: string | null;
    current_discounted_price_set?: {
      shop_money: {
        amount: string;
        currency_code: string;
      };
      presentment_money: {
        amount: string;
        currency_code: string;
      };
    };
    discounted_price: string;
    discounted_price_set?: {
      shop_money: {
        amount: string;
        currency_code: string;
      };
      presentment_money: {
        amount: string;
        currency_code: string;
      };
    };
    is_removed: boolean;
    phone: string | null;
    price: string;
    price_set?: {
      shop_money: {
        amount: string;
        currency_code: string;
      };
      presentment_money: {
        amount: string;
        currency_code: string;
      };
    };
    requested_fulfillment_service_id: number | null;
    source: string;
    title: string;
    tax_lines: any[];
    discount_allocations: any[];
  }[];
  returns: [];
}
