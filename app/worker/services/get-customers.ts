import type { GraphQLClient } from "@shopify/graphql-client";
import type { CustomersResponse, CustomerData } from "~/@types/customer";

/**
 * Fetches a list of customers from the Shopify store using the Admin GraphQL API.
 *
 * This function queries the `customers` resource and returns the first `count` customers
 * (default is 1). Each customer includes basic information such as ID, name, handle, and status.
 *
 * @param {Object} params - The input parameters.
 * @param {any} params.admin - The authenticated Shopify Admin API client.
 * @param {number} [params.count=1] - The number of customers to fetch.
 * @param {string} [params.cursor=null] - Cursor to request a specific page
 *
 * @returns {Promise<CustomerData[]>} A promise that resolves to an array of `CustomerData` objects, or an empty array if the query fails.
 *
 * @example
 * const customers = await getCustomers({ admin, count: 5 });
 * console.log(customers);
 */
export const getCustomers = async ({
  client,
  count = 1,
  cursor = null,
}: {
  client: GraphQLClient;
  count?: number;
  cursor?: string | null;
}): Promise<{ customers: CustomerData[]; cursor?: string | null }> => {
  try {
    const response = await client.request(
      `query getCustomers($count: Int, $cursor: String) {
          customers(first: $count, after: $cursor) {
            nodes {
              id
              firstName
              lastName
              defaultEmailAddress {
                emailAddress
              }
              defaultPhoneNumber {
                phoneNumber
              }
              defaultAddress {
                id
                address1
                address2
                city
                province
                country
                zip
                phone
                provinceCode
                countryCodeV2
              }
              createdAt
              updatedAt
            }
            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }
      `,
      {
        variables: {
          count,
          cursor,
        },
      },
    );

    const customersData = response?.data as CustomersResponse;
    const customers = customersData?.customers?.nodes;
    const endCursor = customersData?.customers?.pageInfo?.endCursor;
    const hasNextPage = customersData?.customers?.pageInfo?.hasNextPage;

    return {
      customers: customers ?? [],
      cursor: hasNextPage ? endCursor : null,
    };
  } catch (error) {
    console.error(error);
    return { customers: [], cursor: null };
  }
};
