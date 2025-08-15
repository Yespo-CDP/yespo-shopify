import { createOrders } from "~/api/create-orders";
import { convertDateToUTC } from "~/utils/convert-date-to-utc";
import { orderSyncRepository } from "~/repositories/repositories.server";
import type { Order, OrderCreatePayload } from "~/@types/order";

/**
 * Creates a order using the provided payload and API key.
 *
 * Any errors during the process are caught and logged.
 *
 * @param {OrderCreatePayload} payload - The order data payload containing order info.
 * @param {string} apiKey - The API key used for authentication with the contact service.
 * @param {string} shopId - The shop id for connect order sync log to shop.
 * @returns {Promise<void>} A promise that resolves when the order creation completes.
 */
export const createOrderService = async (
  payload: OrderCreatePayload,
  apiKey: string,
  shopId: number,
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

    const statusMap = (
      status: OrderCreatePayload["fulfillment_status"],
    ): Order["status"] => {
      if (payload?.cancelled_at) {
        return "CANCELLED";
      }

      switch (status) {
        case "restocked":
          return "CANCELLED";
        case "partial":
          return "IN_PROGRESS";
        case "fulfilled":
          return "DELIVERED";
        default:
          return "INITIALIZED";
      }
    };

    const order = {
      firstName: payload?.customer?.first_name ?? "",
      lastName: payload?.customer?.last_name ?? "",
      email: payload?.email ?? "",
      phone: payload?.phone ?? "",
      externalOrderId: payload.id.toString(),
      externalCustomerId: payload?.customer?.id?.toString(),
      totalCost: parseFloat(payload?.current_total_price ?? "0"),
      discount: parseFloat(payload?.total_discounts ?? "0"),
      shipping: parseFloat(
        payload?.total_shipping_price_set?.shop_money?.amount ?? "0",
      ),
      taxes: parseFloat(payload?.current_total_tax ?? "0"),
      currency: payload.currency,
      date: convertDateToUTC(payload.created_at),
      status: statusMap(payload?.fulfillment_status),
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

    await orderSyncRepository.createOrUpdateOrderSync({
      orderId: payload.admin_graphql_api_id,
      createdAt: payload.created_at,
      updatedAt: payload.updated_at,
      shop: {
        connect: {
          id: shopId,
        },
      },
    });
  } catch (error: any) {
    console.error("Error occurred in Create Order Service", error);
  }
};
