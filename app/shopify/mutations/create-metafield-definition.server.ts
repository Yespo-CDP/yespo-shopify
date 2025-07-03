/**
 * Creates a metafield definition in Shopify for the shop resource using the Admin GraphQL API.
 *
 * This function defines the schema of a custom metafield, including its access levels,
 * key, name, description, namespace, type, and owner type. The metafield will be created
 * in the `$app` namespace and will be visible in both the Admin (`MERCHANT_READ`) and
 * Storefront (`PUBLIC_READ`) scopes.
 *
 * @param {Object} params - The input parameters.
 * @param {any} params.admin - The authenticated Shopify Admin API client.
 * @param {string} params.key - The key (identifier) for the metafield.
 * @param {string} params.name - The display name for the metafield.
 * @param {string} params.description - The description of the metafield for merchant visibility.
 *
 * @returns {Promise<void>} A promise that resolves once the definition has been created or logs an error on failure.
 *
 * @example
 * await createMetafieldDefinition({
 *   admin,
 *   key: "custom_tagline",
 *   name: "Custom Tagline",
 *   description: "A short custom tagline shown on the storefront",
 * });
 */
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
