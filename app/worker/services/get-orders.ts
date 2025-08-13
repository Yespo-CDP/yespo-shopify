import type { GraphQLClient } from "@shopify/graphql-client";
import type { OrdersResponse, OrderData } from "~/@types/order";

/**
 * Fetches a list of orders from the Shopify store using the Admin GraphQL API.
 *
 * This function queries the `orders` resource and returns the first `count` orders
 * (default is 1). Each orders includes basic information such as ID, name, handle, and status.
 *
 * @param {Object} params - The input parameters.
 * @param {GraphQLClient} params.client - The authenticated Shopify Admin API client.
 * @param {number} [params.count=1] - The number of orders to fetch.
 * @param {string} [params.cursor=null] - Cursor to request a specific page
 *
 * @returns {Promise<OrderData[]>} A promise that resolves to an array of `OrderData` objects, or an empty array if the query fails.
 *
 * @example
 * const orders = await getOrders({ client, count: 5 });
 * console.log(orders);
 */
export const getOrders = async ({
  client,
  count = 1,
  cursor = null,
}: {
  client: GraphQLClient;
  count?: number;
  cursor?: string | null;
}): Promise<{ orders: OrderData[]; cursor?: string | null }> => {
  try {
    const response = await client.request(
      `query getOrders($count: Int, $cursor: String) {
          orders(first: $count, after: $cursor) {
            nodes {
              id
              email
              phone
              currencyCode
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              totalTaxSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              totalShippingPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              totalDiscountsSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              shippingAddress {
                id
                firstName
                lastName
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
              customer {
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
              }
              lineItems(first: 100) {
                nodes {
                  id
                  name
                  quantity
                  originalTotalSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                }
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

    const ordersData = response?.data as OrdersResponse;
    const orders = ordersData?.orders?.nodes;
    const endCursor = ordersData?.orders?.pageInfo?.endCursor;
    const hasNextPage = ordersData?.orders?.pageInfo?.hasNextPage;

    return {
      orders: orders ?? [],
      cursor: hasNextPage ? endCursor : null,
    };
  } catch (error) {
    console.error(error);
    return { orders: [], cursor: null };
  }
};
