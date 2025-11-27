import {CategoryResponse} from "~/@types/category";

interface GetCategoriesParams {
  admin: any;
  // Number of collections to load
  count?: number;
  // Cursor for loading next page
  after?: string | null;
  search?: string
}
const getCategories = async ({
                                 admin,
                                 count = 50,
                                 after = null,
  search = ''
                               }: GetCategoriesParams) => {
  try {
    const response = await admin.graphql(`
      #graphql
      query getCategories(
        $count: Int!
        $after: String
        $search: String
      ) {
        taxonomy {
          categories(first: $count, after: $after, search: $search) {
            nodes {
              id
              level
              name
              fullName
              childrenIds
            }
            pageInfo {
              hasNextPage
              hasPreviousPage
              endCursor
              startCursor
            }
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
    const typesData = responseJson?.data as CategoryResponse | undefined;

    const categories = typesData?.taxonomy?.categories?.nodes ?? [];
    const pageInfo = typesData?.taxonomy?.categories?.pageInfo ?? {
      hasNextPage: false,
      hasPreviousPage: false,
      endCursor: "",
      startCursor: "",
    };

    return {
      categories,
      pageInfo,
    };
  } catch (error) {
    console.error(error)
    return {
      categories: [],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        endCursor: "",
        startCursor: "",
      },
    };
  }
}

export default getCategories;
