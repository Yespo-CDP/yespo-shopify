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
      query getmetafieldDefinitions($ownerType: MetafieldOwnerType!, $query: String!) {
        metafieldDefinitions(first: 1, ownerType: $ownerType, query: $query) {
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
          ownerType: "SHOP",
          query: `key:${key}`,
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
    const metafieldDefinition = metafieldDefinitions?.find(
      (metafieldDefinition) => metafieldDefinition.key === key,
    );

    return metafieldDefinition ?? null;
  } catch (error) {
    console.error(error);
    return null;
  }
};

export default getMetafieldDefinition;
