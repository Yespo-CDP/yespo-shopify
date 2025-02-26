import type { ShopData, ShopDataResponse } from "~/@types/shop";

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
