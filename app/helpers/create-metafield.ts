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
}) {
  await admin.graphql(
    `
    #graphql
    mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          key
          value
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
            namespace: process.env.METAFIELD_NAMESPACE,
            type: "single_line_text_field",
            value: value.replace(/\n/g, "").replace(/\s+/g, " ").trim(),
            ownerId: shopId,
          },
        ],
      },
    },
  );
}

export default createMetafield;
