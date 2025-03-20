async function createMetafieldDefinition({
  admin,
  key,
  name,
  description,
}: {
  admin: any;
  key: string;
  name: string;
  description: string;
}) {
  try {
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
            name,
            description,
            namespace: "$app",
            type: "single_line_text_field",
            ownerType: "SHOP",
          },
        },
      },
    );
  } catch (error) {
    console.error(error);
  }
}

export default createMetafieldDefinition;
