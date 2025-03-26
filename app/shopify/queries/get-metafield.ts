import type { MetafieldResponse, Metafield } from "~/@types/metafield";

const getMetafield = async ({
  admin,
  key,
}: {
  admin: any;
  key: string;
}): Promise<Metafield | null> => {
  try {
    const response = await admin.graphql(
      `
      #graphql
      query ShopMetafield($namespace: String!, $key: String!) {
        shop {
          metafield(namespace: $namespace, key: $key) {
            id
            type
            value
            ownerType
            namespace
            key
          }
        }
      }`,
      {
        variables: {
          namespace: "$app",
          key,
        },
      },
    );

    if (!response) {
      console.error("Response is null or undefined");
      return null;
    }

    const responseParse = await response.json();
    const metafieldData = responseParse?.data as MetafieldResponse;
    const metafield = metafieldData?.shop?.metafield;

    return metafield ?? null;
  } catch (error) {
    console.error(error);
    return null;
  }
};

export default getMetafield;
