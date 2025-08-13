import type { Order, OrderData } from "~/@types/order";

/**
 * Convert Shopify Order data to Yespo order data
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
    date: new Date(order.createdAt),
    status: "INITIALIZED",
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
