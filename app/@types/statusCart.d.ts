export interface ICartCustomer {
  externalCustomerId?: string;
  user_phone?: string;
  user_email?: string;
  user_name?: string;
}
export interface IGeneralInfo {
  eventName: string;
  siteId: string;
  datetime: number;
  externalCustomerId?: string;
  user_phone?: string;
  user_email?: string;
  user_name?: string;
  cookies: {
    sc: string
  }
}
interface ICartProduct {
  productKey: string;
  price: string;
  discount?: string;
  quantity: number;
  price_currency_code?: string;
}

interface IStatusCart {
  GUID: string;
  Products: ICartProduct[]
}
export interface StatusCartEvent {
  GeneralInfo: IGeneralInfo;
  StatusCart: IStatusCart
}
