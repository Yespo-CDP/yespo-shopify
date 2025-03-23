import type { MetafieldDefinition } from "~/@types/metafield";

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
