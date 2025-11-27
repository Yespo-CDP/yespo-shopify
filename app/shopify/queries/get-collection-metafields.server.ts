interface CollectionMetafield {
  id: string;
  key: string;
  value: string;
  namespace: string;
}

interface CollectionMetafieldsResponse {
  collection: {
    metafields: {
      nodes: CollectionMetafield[];
    };
  };
}

/**
 * Get metafields for a specific collection
 */
const getCollectionMetafields = async ({
  admin,
  collectionId,
}: {
  admin: any;
  collectionId: string;
}): Promise<Record<string, string>> => {
  try {
    const response = await admin.graphql(
      `
      #graphql
      query getCollectionMetafields($id: ID!) {
        collection(id: $id) {
          metafields(namespace: "$app", first: 10) {
            nodes {
              id
              key
              value
              namespace
            }
          }
        }
      }
    `,
      {
        variables: {
          id: collectionId,
        },
      }
    );

    const responseJson = await response.json();
    const data = responseJson?.data as CollectionMetafieldsResponse | undefined;

    if (!data?.collection?.metafields?.nodes) {
      return {};
    }

    // Convert array to key-value object
    const metafields: Record<string, string> = {};
    data.collection.metafields.nodes.forEach((metafield) => {
      metafields[metafield.key] = metafield.value;
    });

    return metafields;
  } catch (error) {
    console.error('[getCollectionMetafields] Error:', error);
    return {};
  }
};

export default getCollectionMetafields;

