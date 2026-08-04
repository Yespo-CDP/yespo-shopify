import type { ShopMarket } from "@prisma/client";
import type { ShopMarketConfig } from "~/@types/shopMarketsConfig";

export default interface ShopMarketRepository {
  getByShopId(shopId: number): Promise<ShopMarket[]>;

  upsertMarket(
    shopId: number,
    market: ShopMarketConfig,
  ): Promise<ShopMarket>;

  replaceAll(
    shopId: number,
    markets: ShopMarketConfig[],
  ): Promise<void>;
}
