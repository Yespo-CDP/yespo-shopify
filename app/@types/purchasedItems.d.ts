import type { IGeneralInfo } from "~/@types/statusCart";

interface IPurchasedItemsProduct {
  product_id: string;
  unit_price: string;
  quantity: number;
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
