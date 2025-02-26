import type { MetafieldDefinition } from "~/@types/metafield";

const getMetafieldDefinition = async ({
  admin,
}: {
  admin: any;
}): Promise<MetafieldDefinition | null> => {
  try {
    const response = await admin.graphql(
      `
      #graphql
      query getmetafieldDefinitions($ownerType: MetafieldOwnerType!) {
        metafieldDefinitions(first: 250, ownerType: $ownerType) {
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
      (metafieldDefinition) =>
        metafieldDefinition.key === process.env.SCRIPT_HANDLE,
    );

    return metafieldDefinition ?? null;
  } catch (error) {
    console.error(error);
    return null;
  }
};

export default getMetafieldDefinition;
