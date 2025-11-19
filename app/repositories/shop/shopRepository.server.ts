import type { Shop, ShopUpdate, ShopCreate } from "~/@types/shop";

/**
 * Interface defining methods for managing shops in the db.
 */
export default interface ShopRepository {
  /**
   * Retrieves a shop by its URL.
   *
   * @param {string} shopUrl - The unique URL identifier of the shop.
   * @returns {Promise<Shop | null>} A promise that resolves to the Shop object if found, or null otherwise.
   */
  getShop(shopUrl: string): Promise<Shop | null>;

  /**
   * Retrieves a shop by its domain.
   *
   * @param {string} domain - The unique domain identifier of the shop.
   * @returns {Promise<Shop | null>} A promise that resolves to the Shop object if found, or null otherwise.
   */
  getShopByDomain(domain: string): Promise<Shop | null>;

  /**
   * Creates a new shop record in the db.
   *
   * @param {ShopCreate} data - The data used to create the shop.
   * @returns {Promise<Shop>} A promise that resolves to the newly created Shop object.
   */
  createShop(data: ShopCreate): Promise<Shop>;

  /**
   * Updates an existing shop identified by its URL.
   *
   * @param {string} shopUrl - The unique URL identifier of the shop to update.
   * @param {ShopUpdate} data - The data used to update the shop.
   * @returns {Promise<Shop>} A promise that resolves to the updated Shop object.
   */
  updateShop(shopUrl: string, data: ShopUpdate): Promise<Shop>;
}
