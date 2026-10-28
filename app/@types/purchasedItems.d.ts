import type { IGeneralInfo } from "~/@types/statusCart";

interface IPurchasedItemsProduct {
  productKey: string;
  unit_price: string;
  quantity: number;
  price_currency_code?: string;
}
interface IPurchasedItems{
  Products: IPurchasedItemsProduct[];
  OrderNumber: string;
}

export interface PurchasedItemsEvent {
  GeneralInfo: IGeneralInfo;
  TrackedOrderId: string;
  PurchasedItems: IPurchasedItems;
}
