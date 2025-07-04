import type { ShopData, ShopDataResponse } from "~/@types/shop";

/**
 * Retrieves basic information about the Shopify store using the Admin GraphQL API.
 *
 * This function queries the `shop` object and returns details including the shop ID,
 * domain, contact emails, name, URL, and primary domain. It safely parses the API response
 * and returns `null` if the request fails or no data is available.
 *
 * @param {Object} params - The input parameters.
 * @param {any} params.admin - The authenticated Shopify Admin API client instance.
 *
 * @returns {Promise<ShopData | null>} A promise that resolves to a `ShopData` object
 * if the query is successful, or `null` if an error occurs.
 *
 * @example
 * const shopInfo = await getShop({ admin });
 * if (shopInfo) {
 *   console.log("Shop name:", shopInfo.name);
 * }
 */
const getShop = async ({ admin }: { admin: any }): Promise<ShopData | null> => {
  try {
    const response = await admin.graphql(`
      #graphql
      query {
        shop {
          id
          myshopifyDomain
          contactEmail
          email
          name
          url
          primaryDomain {
            id
            host
          }
        }
      }
    `);

    const responseParse = await response.json();
    const shopData = responseParse?.data as ShopDataResponse;
    return shopData?.shop ?? null;
  } catch (error) {
    console.error(error);
    return null;
  }
};

export default getShop;
