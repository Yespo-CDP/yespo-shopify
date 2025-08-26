import type { MetafieldResponse, Metafield } from "~/@types/metafield";

/**
 * Retrieves a specific shop-level metafield from the Shopify store using the Admin GraphQL API.
 *
 * This function queries a single metafield by its `key` from the `$app` namespace.
 * If the metafield exists, it returns its metadata including ID, value, and type.
 * If the metafield is not found or an error occurs, it returns `null`.
 *
 * @param {Object} params - The input parameters.
 * @param {any} params.admin - The authenticated Shopify Admin API client instance.
 * @param {string} params.key - The key of the metafield to retrieve.
 *
 * @returns {Promise<Metafield | null>} A promise that resolves to the metafield object if found, or `null` otherwise.
 *
 * @example
 * const metafield = await getMetafield({ admin, key: "custom_config" });
 * if (metafield) {
 *   console.log("Metafield value:", metafield.value);
 * }
 */
const getMetafield = async ({
  admin,
  key,
}: {
  admin: any;
  key: string;
}): Promise<Metafield | null> => {
  try {
    const response = await admin.graphql(
      `
      #graphql
      query ShopMetafield($namespace: String!, $key: String!) {
        shop {
          metafield(namespace: $namespace, key: $key) {
            id
            type
            value
            ownerType
            namespace
            key
          }
        }
      }`,
      {
        variables: {
          namespace: "$app",
          key,
        },
      },
    );

    if (!response) {
      console.error("Response is null or undefined");
      return null;
    }

    const responseParse = await response.json();
    const metafieldData = responseParse?.data as MetafieldResponse;
    const metafield = metafieldData?.shop?.metafield;

    return metafield ?? null;
  } catch (error) {
    console.error(error);
    return null;
  }
};

export default getMetafield;
