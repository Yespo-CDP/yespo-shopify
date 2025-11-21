import type { PrismaClient } from "@prisma/client";

import type { Shop, ShopCreate, ShopUpdate } from "~/@types/shop";
import type IShopRepository from "./shopRepository.server";

/**
 * Implementation of the ShopRepository interface using Prisma ORM.
 *
 * Provides methods to perform CRUD operations on the Shop entity
 * within the database.
 */
export default class ShopRepositoryImpl implements IShopRepository {
  /**
   * Creates a new ShopRepositoryImpl instance.
   *
   * @param {PrismaClient} database - The Prisma client instance used for database operations.
   */
  constructor(readonly database: PrismaClient) {}

  /**
   * Retrieves a shop by its URL.
   *
   * @param {string} shopUrl - The unique URL identifier of the shop.
   * @returns {Promise<Shop | null>} A promise that resolves to the Shop object if found, or null otherwise.
   */
  async getShop(shopUrl: string): Promise<Shop | null> {
    return this.database.shop.findFirst({
      where: { shopUrl },
    });
  }

  /**
   * Retrieves a shop by its domain.
   *
   * @param {string} domain - The unique domain identifier of the shop.
   * @returns {Promise<Shop | null>} A promise that resolves to the Shop object if found, or null otherwise.
   */
  async getShopByDomain(domain: string): Promise<Shop | null> {
    return this.database.shop.findFirst({
      where: { domain },
    });
  }

  /**
   * Creates a new shop record.
   *
   * @param {ShopCreate} data - The data used to create the shop.
   * @returns {Promise<Shop>} A promise that resolves to the newly created Shop object.
   */
  async createShop(data: ShopCreate): Promise<Shop> {
    return this.database.shop.create({
      data,
    });
  }

  /**
   * Updates an existing shop by its URL.
   *
   * @param {string} shopUrl - The unique URL identifier of the shop to update.
   * @param {ShopUpdate} data - The data used to update the shop.
   * @returns {Promise<Shop>} A promise that resolves to the updated Shop object.
   */
  async updateShop(shopUrl: string, data: ShopUpdate): Promise<Shop> {
    const shop = await this.database.shop.findFirst({
      where: {
        OR: [
          { shopUrl },
          { domain: shopUrl },
        ],
      },
    });

    if (!shop) {
      throw new Error("Shop not found");
    }

    return this.database.shop.update({
      where: { id: shop.id },
      data,
    });
  }

  /**
   * Deletes a shop by its URL.
   *
   * @param {string} shopUrl - The unique URL identifier of the shop to delete.
   * @returns {Promise<Shop>} A promise that resolves to the deleted Shop object.
   */
  async deleteShop(shopUrl: string): Promise<Shop> {
    return this.database.shop.delete({
      where: { shopUrl },
    });
  }
}
