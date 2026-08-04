import type { PrismaClient, ShopMarket } from "@prisma/client";

import type { ShopMarketConfig } from "~/@types/shopMarketsConfig";
import type ShopMarketRepository from "./shopMarketRepository.server";

export default class ShopMarketRepositoryImpl implements ShopMarketRepository {
  constructor(readonly database: PrismaClient) {}

  async getByShopId(shopId: number): Promise<ShopMarket[]> {
    return this.database.shopMarket.findMany({ where: { shopId } });
  }

  async upsertMarket(
    shopId: number,
    market: ShopMarketConfig,
  ): Promise<ShopMarket> {
    return this.database.shopMarket.upsert({
      where: {
        shopId_marketId: { shopId, marketId: market.id },
      },
      create: {
        shopId,
        marketId: market.id,
        name: market.name,
        handle: market.handle,
        enabled: market.enabled,
        countries: market.countries,
        locales: market.locales,
      },
      update: {
        name: market.name,
        handle: market.handle,
        enabled: market.enabled,
        countries: market.countries,
        locales: market.locales,
        updatedAt: new Date(),
      },
    });
  }

  async replaceAll(
    shopId: number,
    markets: ShopMarketConfig[],
  ): Promise<void> {
    const incomingIds = markets.map((m) => m.id);

    await this.database.$transaction([
      this.database.shopMarket.deleteMany({
        where: {
          shopId,
          ...(incomingIds.length > 0
            ? { NOT: { marketId: { in: incomingIds } } }
            : {}),
        },
      }),
      ...markets.map((market) =>
        this.database.shopMarket.upsert({
          where: { shopId_marketId: { shopId, marketId: market.id } },
          create: {
            shopId,
            marketId: market.id,
            name: market.name,
            handle: market.handle,
            enabled: market.enabled,
            countries: market.countries,
            locales: market.locales,
          },
          update: {
            name: market.name,
            handle: market.handle,
            enabled: market.enabled,
            countries: market.countries,
            locales: market.locales,
            updatedAt: new Date(),
          },
        }),
      ),
    ]);
  }
}
