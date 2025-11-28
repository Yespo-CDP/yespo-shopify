import {CollectionResponse} from "~/@types/collection";

interface GetCollectionsParams {
  admin: any;
  // Number of collections to load
  count?: number;
  // Cursor for loading next page
  after?: string | null;
  // Cursor for loading previous page
  before?: string | null;
  // Search query
  query?: string | null;
}

export interface GetCollectionsResult {
  collections: CollectionResponse["collections"]["nodes"];
  pageInfo: CollectionResponse["collections"]["pageInfo"];
}

const getCollections = async ({
  admin,
  count = 50,
  after = null,
  before = null,
  query = null,
}: GetCollectionsParams): Promise<GetCollectionsResult> => {
  try {
    // Use 'last' + 'before' for backward pagination, 'first' + 'after' for forward
    const useBefore = before && !after;

    const graphqlQuery = useBefore
      ? `
        #graphql
        query getCollections(
          $count: Int!
          $before: String
          $key: String!
          $query: String
        ) {
          collections(
            last: $count
            before: $before
            query: $query
          ) {
            nodes {
              id
              title
              image {
                url
              }
              metafield(namespace: "$app", key: $key) {
                  key
                  value
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
      `
      : `
        #graphql
        query getCollections(
          $count: Int!
          $after: String
          $key: String!
          $query: String
        ) {
          collections(
            first: $count
            after: $after
            query: $query
          ) {
            nodes {
              id
              title
              image {
                url
              }
              metafield(namespace: "$app", key: $key) {
                  key
                  value
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
      `;

    const variables = useBefore
      ? {
          count,
          before,
          key: process.env.CATEGORY_TYPE_HANDLE || 'yespo_category_type',
          query: query ? `title:*${query}*` : null
        }
      : {
          count,
          after,
          key: process.env.CATEGORY_TYPE_HANDLE || 'yespo_category_type',
          query: query ? `title:*${query}*` : null
        };

    const response = await admin.graphql(graphqlQuery, { variables });

    const responseJson = await response.json();
    const collectionsData = responseJson?.data as CollectionResponse | undefined;

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
