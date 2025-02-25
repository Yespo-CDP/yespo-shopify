async function createDefinition({ admin, key }: { admin: any; key: string }) {
  await admin.graphql(
    `
    #graphql
    mutation metafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition {
          access {
            storefront
          }
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
        definition: {
          access: {
            admin: "MERCHANT_READ",
            storefront: "PUBLIC_READ",
          },
          key,
          name: process.env.METAFIELD_NAME,
          description: process.env.METAFIELD_DESCRIPTION,
          namespace: process.env.METAFIELD_NAMESPACE,
          type: "single_line_text_field",
          ownerType: "SHOP",
        },
      },
    },
  );
}

export default createDefinition;
