/**
 * Deletes multiple metafields from a Shopify resource using the Admin GraphQL API.
 *
 * This function sends a `metafieldsDelete` mutation to remove metafields identified by their keys
 * and the associated resource (`ownerId`). All metafields are assumed to exist within the `$app` namespace.
 *
 * Any GraphQL or execution errors will be caught and logged to the console.
 *
 * @param {Object} params - The input parameters.
 * @param {any} params.admin - The authenticated Shopify Admin API client.
 * @param {string} params.ownerId - The Shopify GID of the resource (e.g., shop) that owns the metafields.
 * @param {string[]} params.keys - An array of metafield keys to be deleted.
 *
 * @returns {Promise<void>} A promise that resolves when the deletion completes or logs an error if it fails.
 *
 * @example
 * await deleteMetafields({
 *   admin,
 *   ownerId: "gid://shopify/Shop/123456789",
 *   keys: ["custom_note", "internal_flag"],
 * });
 */
async function deleteMetafields({
  admin,
  ownerId,
  keys,
}: {
  admin: any;
  ownerId: string;
  keys: string[];
}) {
  try {
    await admin.graphql(
      `
      #graphql
      mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
        metafieldsDelete(metafields: $metafields) {
          deletedMetafields {
            key
            namespace
            ownerId
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
          metafields: keys.map((key) => ({
            key,
            ownerId,
            namespace: "$app",
          })),
        },
      },
    );
  } catch (error) {
    console.error(error);
  }
}

export default deleteMetafields;
