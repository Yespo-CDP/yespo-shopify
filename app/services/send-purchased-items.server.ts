import type { Shop } from "~/@types/shop";
import { eventDataRepository } from "~/repositories/repositories.server";
import type { ICartCustomer } from "~/@types/statusCart";
import { buildCustomerData } from "~/utils/buildCustomerData";
import { v4 as uuidv4 } from "uuid";
import type { PurchasedItemsEvent } from "~/@types/purchasedItems";
import { sendPurchasedItemsEvent } from "~/api/send-purchased-items-event";
import { readMarketId } from "~/services/market-tracking";

/**
 * Sends purchased items event data to the tracking service based on the given webhook payload and shop.
 *
 * This function retrieves event data for the cart token, constructs the customer and product data,
 * and sends the purchase event to the external tracking API using the shop's API key.
 * If required data is missing (event data, API key, or site ID), the function returns early without sending.
 * The webhook uses the result to send the order to Yespo when the event was not sent.
 *
 * @async
 * @function sendPurchasedItemsService
 * @param {any} payload - The webhook payload containing purchase and customer details.
 * @param {Shop} shop - The shop object containing API key and site ID.
 * @returns {Promise<boolean>} `true` only when the event was sent; `false` when data is missing, sending failed, or an error occurred.
 *
 * @example
 * await sendPurchasedItemsService(webhookPayload, shop);
 */
export const sendPurchasedItemsService = async (
  payload: any,
  shop: Shop,
): Promise<boolean> => {
  try {
    const cartAttribute = payload.note_attributes.find(
      (attr: { name: string; value: string }) =>
        attr.name.trim().toLowerCase() === "cart token" ||
        attr.name.trim().toLowerCase() === "cartid",
    )?.value;
    let cartToken = payload.cart_token ?? cartAttribute;

    if (!cartToken) {
      console.error("Cart token doesn't exist");
      return false;
    }
    if (cartToken.includes("?key=")) {
      cartToken = cartToken.split("?key=")[0];
    }

    const eventData = await eventDataRepository.getEventData(shop.id, cartToken);

    if (!eventData) {
      console.error("Event data not exist");
      return false;
    }

    if (!shop.apiKey) {
      console.error("Api key does not provided");
      return false;
    }

    if (!shop.siteId) {
      console.error("Site id does not provided");
      return false;
    }

    const customerData: ICartCustomer = buildCustomerData(payload.customer);
    const marketId = readMarketId(eventData.marketId) ?? undefined;

    const productsData = payload.line_items.map((item: any) => {
      const presentment = item.price_set?.presentment_money;
      return {
        productKey: String(item.variant_id ?? item.id),
        unit_price: presentment?.amount ?? item.price,
        quantity: item.quantity,
        price_currency_code:
          presentment?.currency_code ?? payload.presentment_currency ?? payload.currency,
      };
    });

    const purchasedItemsData: PurchasedItemsEvent = {
      GeneralInfo: {
        eventName: "PurchasedItems",
        siteId: shop.siteId,
        datetime: Date.now(),
        cookies: {
          sc: eventData.sc,
        },
        ...(marketId ? { marketId } : {}),
        ...customerData,
      },
      TrackedOrderId: uuidv4(),
      PurchasedItems: {
        Products: productsData,
        OrderNumber: payload.id.toString(),
      },
    };

    const sent = await sendPurchasedItemsEvent({
      apiKey: shop.apiKey,
      purchasedItemsData,
      domain: shop.domain || shop.shopUrl,
      orgId: shop.orgId,
    });
    if (!sent) {
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error occurred in Send Purchased Items Service", error);
    return false;
  }
};
