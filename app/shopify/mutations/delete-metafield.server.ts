async function deleteMetafield({
  admin,
  ownerId,
  key,
}: {
  admin: any;
  ownerId: string;
  key: string;
}) {
  try {
    await admin.graphql(
      `
      #graphql
      mutation metafieldDelete($metafields: [MetafieldIdentifierInput!]!) {
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
          metafields: [
            {
              key,
              ownerId,
              namespace: "$app",
            },
          ],
        },
      },
    );
  } catch (error) {
    console.error(error);
  }
}

export default deleteMetafield;
