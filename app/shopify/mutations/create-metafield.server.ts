import type { Metafield } from "~/@types/metafield";

/**
 * Creates a metafield on the Shopify shop using the admin GraphQL API.
 *
 * This function sends a `metafieldsSet` GraphQL mutation to Shopify, creating a metafield
 * in the `$app` namespace with a `single_line_text_field` type. It automatically strips
 * newline characters and trims excess whitespace from the value.
 *
 * @param {Object} params - The input parameters.
 * @param {any} params.admin - The authenticated Shopify Admin API client.
 * @param {string} params.shopId - The Shopify shop's GID (global ID) used as the metafield's owner.
 * @param {string} params.key - The metafield key.
 * @param {string} params.value - The string value to store in the metafield.
 *
 * @returns {Promise<Metafield | null>} A promise that resolves to the created metafield,
 * or `null` if the operation failed or no metafield was returned.
 *
 * @example
 * const metafield = await createMetafield({
 *   admin,
 *   shopId: "gid://shopify/Shop/123456789",
 *   key: "my_custom_key",
 *   value: "My value",
 * });
 */

async function createMetafield({
  admin,
  shopId,
  key,
  value,
}: {
  admin: any;
  shopId: string;
  key: string;
  value: string;
}): Promise<Metafield | null> {
  try {
    const response = await admin.graphql(
      `
      #graphql
      mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            key
            value
            ownerType
            namespace
            type
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
      {
        variables: {
          metafields: [
            {
              key,
              namespace: "$app",
              type: "single_line_text_field",
              value: value.replace(/\n/g, "").replace(/\s+/g, " ").trim(),
              ownerId: shopId,
            },
          ],
        },
      },
    );

    const responseParse = await response.json();
    const metafieldData = responseParse?.data as {
      metafieldsSet: { metafields: Metafield[] };
    };
    const metafield = metafieldData?.metafieldsSet?.metafields[0];

    return metafield ?? null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export default createMetafield;
