import {CollectionResponse} from "~/@types/collection";

interface GetCollectionsParams {
  admin: any;
  // Number of collections to load
  count?: number;
  // Cursor for loading next page
  after?: string | null;
}

export interface GetCollectionsResult {
  collections: CollectionResponse["collections"]["nodes"];
  pageInfo: CollectionResponse["collections"]["pageInfo"];
}

const getCollections = async ({
  admin,
  count = 50,
  after = null,
}: GetCollectionsParams): Promise<GetCollectionsResult> => {
  try {
    const response = await admin.graphql(
      `
      #graphql
      query getCollections(
        $count: Int!
        $after: String
      ) {
        collections(
          first: $count
          after: $after
        ) {
          nodes {
            id
            title
            image {
              url
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            endCursor
            startCursor
          }
        }
      }
    `,
      {
        variables: {
          count,
          after,
        },
      },
    );

    const responseJson = await response.json();
    const collectionsData = responseJson?.data as CollectionResponse | undefined;

    console.log('responseJson', JSON.stringify(responseJson, null, 2))

    const collections = collectionsData?.collections?.nodes ?? [];
    const pageInfo = collectionsData?.collections?.pageInfo ?? {
      hasNextPage: false,
      hasPreviousPage: false,
      endCursor: "",
      startCursor: "",
    };

    return {
      collections,
      pageInfo,
    };
  } catch (error) {
    // log error for debugging
    console.error("[getCollections] Failed to fetch collections", error);

    return {
      collections: [],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        endCursor: "",
        startCursor: "",
      },
    };
  }
};

export default getCollections;
