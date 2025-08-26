import type { MetafieldDefinition } from "~/@types/metafield";

/**
 * Retrieves a specific metafield definition for the shop from the Shopify Admin GraphQL API.
 *
 * This function queries the `metafieldDefinitions` resource using a given `key`, `$app` namespace,
 * and `SHOP` owner type. If a matching metafield definition is found, it returns the first result.
 * Returns `null` if not found or if an error occurs during the request.
 *
 * @param {Object} params - The input parameters.
 * @param {any} params.admin - The authenticated Shopify Admin API client.
 * @param {string} params.key - The key of the metafield definition to retrieve.
 *
 * @returns {Promise<MetafieldDefinition | null>} A promise that resolves to the matching `MetafieldDefinition` or `null`.
 *
 * @example
 * const definition = await getMetafieldDefinition({ admin, key: "custom_config" });
 * if (definition) {
 *   console.log("Definition name:", definition.name);
 * }
 */
const getMetafieldDefinition = async ({
  admin,
  key,
}: {
  admin: any;
  key: string;
}): Promise<MetafieldDefinition | null> => {
  try {
    const response = await admin.graphql(
      `
      #graphql
      query getmetafieldDefinitions($ownerType: MetafieldOwnerType!, $key: String!, $namespace: String) {
        metafieldDefinitions(first: 1, ownerType: $ownerType, key: $key, namespace: $namespace) {
          nodes {
            id
            name
            description
            key
            namespace
            ownerType
            type {
              name
            }
            access {
              admin
              storefront
            }
          }
        }
      }`,
      {
        variables: {
          key,
          namespace: "$app",
          ownerType: "SHOP",
        },
      },
    );

    const responseParse = await response.json();
    const metafieldDefinitionsData = responseParse?.data as {
      metafieldDefinitions: {
        nodes: MetafieldDefinition[];
      };
    };
    const metafieldDefinitions =
      metafieldDefinitionsData.metafieldDefinitions?.nodes;
    const metafieldDefinition = metafieldDefinitions?.[0];

    return metafieldDefinition ?? null;
  } catch (error) {
    console.error(error);
    return null;
  }
};

export default getMetafieldDefinition;
