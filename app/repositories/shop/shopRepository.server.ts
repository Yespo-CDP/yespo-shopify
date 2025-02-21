import type { Shop, ShopUpdate, ShopCreate } from "~/@types/shop";

export default interface ShopRepository {
  getShop(shopUrl: string): Promise<Shop | null>;
  createShop(data: ShopCreate): Promise<Shop>;
  updateShop(shopUrl: string, data: ShopUpdate): Promise<Shop>;
}
