import type {
  Order,
  OrderData,
  OrderDisplayFulfillmentStatus,
} from "~/@types/order";
import { convertDateToUTC } from "~/utils/convert-date-to-utc";

/**
 * Convert Shopify Order data to Yespo order data.
 *
 * This function maps Shopify `OrderData` fields into Yespo `Order` format.
 *
 * **Shopify Orders API (GraphQL):**  
 * https://shopify.dev/docs/api/admin-graphql/latest/queries/orders
 *
 * **Yespo Orders Bulk Insert API:**  
 * https://docs.esputnik.com/reference/ordersbulkinsert-1
 * 
 * **Field Mapping:**
 * - `order.id` → `externalOrderId`
 * - `order.customer.id` → `externalCustomerId`
 * - `order.customer.firstName` → `firstName`
 * - `order.customer.lastName` → `lastName`
 * - `order.customer.defaultEmailAddress.emailAddress` → `email`
 * - `order.customer.defaultPhoneNumber.phoneNumber` → `phone`
 * - `order.totalPriceSet.shopMoney.amount` → `totalCost`
 * - `order.totalDiscountsSet.shopMoney.amount` → `discount`
 * - `order.totalShippingPriceSet.shopMoney.amount` → `shipping`
 * - `order.totalTaxSet.shopMoney.amount` → `taxes`
 * - `order.currencyCode` → `currency`
 * - `order.createdAt` (converted to UTC) → `date`
 * - `order.displayFulfillmentStatus` (+ cancelledAt check) → `status`
 * - `order.shippingAddress` (formatted string) → `deliveryAddress`
 * - `order.lineItems.nodes[]`:
 *    - `lineItem.id` → `externalItemId`
 *    - `lineItem.name` → `name`
 *    - `lineItem.quantity` → `quantity`
 *    - `lineItem.originalTotalSet.shopMoney.amount` → `cost`
 *
 * @param {OrderData} order - Shopify order data.
 * @returns {Promise<Order>} A promise that resolves when the order payload is created successfully.
 *
 * @example
 * const orderPayload = await createOrderPayload(order);
 * console.log(orderPayload);
 */

export const createOrderPayload = (order: OrderData): Order => {
  const customerFirstName = order?.customer?.firstName ?? "";
  const customerLastName = order?.customer?.lastName ?? "";
  const customerEmail = order?.customer?.defaultEmailAddress?.emailAddress;
  const customerPhone = order?.customer?.defaultPhoneNumber?.phoneNumber;
  const externalOrderId = order.id?.split("/").pop() ?? "";
  const externalCustomerId = order?.customer?.id?.split("/").pop() ?? "";

  const formatAddress = (address: OrderData["shippingAddress"]) =>
    [
      address?.firstName && address?.lastName
        ? `${address?.firstName} ${address?.lastName}`
        : address?.firstName || address?.lastName,
      address?.address1,
      address?.address2,
      address?.city,
      address?.province,
      address?.zip,
      address?.country,
    ]
      .filter(Boolean)
      .join(", ");

  const statusMap = (
    status: OrderDisplayFulfillmentStatus,
  ): Order["status"] => {
    if (order?.cancelledAt) {
      return "CANCELLED";
    }

    switch (status) {
      case "REQUEST_DECLINED":
        return "CANCELLED";
      case "IN_PROGRESS":
      case "PARTIALLY_FULFILLED":
      case "PENDING_FULFILLMENT":
        return "IN_PROGRESS";
      case "FULFILLED":
        return "DELIVERED";
      default:
        return "INITIALIZED";
    }
  };

  const orderPayload: Order = {
    externalCustomerId,
    externalOrderId,
    firstName: customerFirstName,
    lastName: customerLastName,
    email: customerEmail,
    phone: customerPhone,
    totalCost: parseFloat(order?.totalPriceSet?.shopMoney?.amount ?? "0"),
    discount: parseFloat(order?.totalDiscountsSet?.shopMoney?.amount ?? "0"),
    shipping: parseFloat(
      order?.totalShippingPriceSet?.shopMoney?.amount ?? "0",
    ),
    taxes: parseFloat(order?.totalTaxSet?.shopMoney?.amount ?? "0"),
    currency: order.currencyCode,
    date: convertDateToUTC(order.createdAt),
    status: statusMap(order.displayFulfillmentStatus),
    deliveryAddress: formatAddress(order?.shippingAddress),
    items: order?.lineItems?.nodes?.map((lineItem) => ({
      externalItemId: lineItem.id?.split("/").pop() ?? "",
      name: lineItem.name,
      quantity: lineItem.quantity,
      cost: parseFloat(lineItem?.originalTotalSet?.shopMoney?.amount ?? "0"),
    })),
  };

  return orderPayload;
};
