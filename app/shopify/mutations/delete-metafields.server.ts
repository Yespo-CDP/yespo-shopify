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
