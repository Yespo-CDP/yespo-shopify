/**
 * Deletes a metafield definition from Shopify using the Admin GraphQL API.
 *
 * This function sends a `metafieldDefinitionDelete` mutation request to remove a metafield
 * definition by its ID. It also deletes all metafields associated with the definition by setting
 * `deleteAllAssociatedMetafields` to `true`.
 *
 * Any errors returned from the API are logged to the console.
 *
 * @param {Object} params - The input parameters.
 * @param {any} params.admin - The authenticated Shopify Admin API client.
 * @param {string} params.id - The ID of the metafield definition to delete (Shopify GID format).
 *
 * @returns {Promise<void>} A promise that resolves when the deletion completes.
 *
 * @example
 * await deleteMetafieldDefinition({
 *   admin,
 *   id: "gid://shopify/MetafieldDefinition/123456789",
 * });
 */
async function deleteMetafieldDefinition({
  admin,
  id,
}: {
  admin: any;
  id: string;
}) {
  try {
    await admin.graphql(
      `
      #graphql
      mutation DeleteMetafieldDefinition($id: ID!, $deleteAllAssociatedMetafields: Boolean!) {
        metafieldDefinitionDelete(id: $id, deleteAllAssociatedMetafields: $deleteAllAssociatedMetafields) {
          deletedDefinitionId
          userErrors {
            field
            message
            code
          }
        }
      }
    `,
      {
        variables: {
          id,
          deleteAllAssociatedMetafields: true,
        },
      },
    );
  } catch (error) {
    console.error(error);
  }
}

export default deleteMetafieldDefinition;
