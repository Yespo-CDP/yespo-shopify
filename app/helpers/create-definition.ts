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
          name: "Yespo script",
          description: "This is a app metafield definition for Yespo script",
          namespace: "$app",
          type: "single_line_text_field",
          ownerType: "SHOP",
        },
      },
    },
  );
}

export default createDefinition;
