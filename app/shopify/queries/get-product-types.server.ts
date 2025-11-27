import {ProductTypesResponse} from "~/@types/productTypes";

interface GetProductTypesParams {
  admin: any;
  // Number of collections to load
  count?: number;
  // Cursor for loading next page
  after?: string | null;
}
const getProductTypes = async ({
                                 admin,
                                 count = 50,
                                 after = null,
                               }: GetProductTypesParams) => {
  try {
    const response = await admin.graphql(`
      #graphql
      query getProductTypes(
        $count: Int!
        $after: String
      ) {
        productTypes(first: $count, after: $after) {
          nodes
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
      }
      )

    const responseJson = await response.json();
    const typesData = responseJson?.data as ProductTypesResponse | undefined;

    const types = typesData?.productTypes?.nodes ?? [];
    const pageInfo = typesData?.productTypes?.pageInfo ?? {
      hasNextPage: false,
      hasPreviousPage: false,
      endCursor: "",
      startCursor: "",
    };

    return {
      types,
      pageInfo,
    };
  } catch (error) {
    console.error(error)
    return {
      types: [],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        endCursor: "",
        startCursor: "",
      },
    };
  }
}

export default getProductTypes;
