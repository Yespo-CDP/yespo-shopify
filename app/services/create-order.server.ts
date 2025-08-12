import { createOrders } from "~/api/create-orders";
import type { OrderCreatePayload } from "~/@types/order";

/**
 * Creates a order using the provided payload and API key.
 *
 * Any errors during the process are caught and logged.
 *
 * @param {OrderCreatePayload} payload - The order data payload containing order info.
 * @param {string} apiKey - The API key used for authentication with the contact service.
 * @returns {Promise<void>} A promise that resolves when the order creation completes.
 */
export const createOrderService = async (
  payload: OrderCreatePayload,
  apiKey: string,
) => {
  try {
    const formatAddress = (address: OrderCreatePayload["shipping_address"]) =>
      [
        address?.first_name && address?.last_name
          ? `${address?.first_name} ${address?.last_name}`
          : address?.first_name || address?.last_name,
        address?.address1,
        address?.address2,
        address?.city,
        address?.province,
        address?.zip,
        address?.country,
      ]
        .filter(Boolean)
        .join(", ");

    const order = {
      firstName: payload?.customer?.first_name ?? "",
      lastName: payload?.customer?.last_name ?? "",
      email: payload?.email ?? "",
      pgone: payload?.phone ?? "",
      externalOrderId: payload.id.toString(),
      externalCustomerId: payload?.customer?.id?.toString(),
      totalCost: parseFloat(payload?.current_total_price ?? "0"),
      discount: parseFloat(payload?.total_discounts ?? "0"),
      shipping: parseFloat(
        payload?.total_shipping_price_set?.shop_money?.amount ?? "0",
      ),
      taxes: parseFloat(payload?.current_total_tax ?? "0"),
      currency: payload.currency,
      date: payload.created_at,
      status: "INITIALIZED",
      deliveryAddress: formatAddress(payload?.shipping_address ?? {}),
      items: payload?.line_items?.map((lineItem) => ({
        externalItemId: lineItem.id.toString(),
        name: lineItem.name,
        quantity: lineItem.quantity,
        cost: parseFloat(lineItem.price),
      })),
    };

    await createOrders({
      apiKey,
      orders: [order],
    });
  } catch (error: any) {
    console.error("Error occurred in Create Order Service", error);
  }
};
