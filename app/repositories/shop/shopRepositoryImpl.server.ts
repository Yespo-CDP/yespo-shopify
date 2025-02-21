import type { PrismaClient } from "@prisma/client";

import type { Shop, ShopCreate, ShopUpdate } from "~/@types/shop";
import type IShopRepository from "./shopRepository.server";

export default class ShopRepositoryImpl implements IShopRepository {
  constructor(readonly database: PrismaClient) {}

  async getShop(shopUrl: string): Promise<Shop | null> {
    return this.database.shop.findFirst({
      where: { shopUrl },
    });
  }

  async createShop(data: ShopCreate): Promise<Shop> {
    return this.database.shop.create({
      data,
    });
  }

  async updateShop(shopUrl: string, data: ShopUpdate): Promise<Shop> {
    return this.database.shop.update({
      where: { shopUrl },
      data,
    });
  }
}
