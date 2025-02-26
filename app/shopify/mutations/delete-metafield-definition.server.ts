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
