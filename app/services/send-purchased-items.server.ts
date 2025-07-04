import type {Shop} from "~/@types/shop";
import {eventDataRepository} from "~/repositories/repositories.server";
import type {ICartCustomer} from "~/@types/statusCart";
import {buildCustomerData} from "~/utils/buildCustomerData";
import {v4 as uuidv4} from "uuid";
import type {PurchasedItemsEvent} from "~/@types/purchasedItems";
import {sendPurchasedItemsEvent} from "~/api/send-purchased-items-event";

/**
 * Sends purchased items event data to the tracking service based on the given webhook payload and shop.
 *
 * This function retrieves event data for the cart token, constructs the customer and product data,
 * and sends the purchase event to the external tracking API using the shop's API key.
 * If required data is missing (event data, API key, or site ID), the function returns early without sending.
 *
 * @async
 * @function sendPurchasedItemsService
 * @param {any} payload - The webhook payload containing purchase and customer details.
 * @param {Shop} shop - The shop object containing API key and site ID.
 * @returns {Promise<void>} Resolves when the purchased items event has been sent or if an error occurs.
 *
 * @example
 * await sendPurchasedItemsService(webhookPayload, shop);
 */
export const sendPurchasedItemsService = async (payload: any, shop: Shop) => {
  try {
    const eventData = await eventDataRepository.getEventData(payload.cart_token)

    if (!eventData || !shop.apiKey || !shop.siteId) {
      return null
    }

    const customerData: ICartCustomer = buildCustomerData(payload.customer)

    const productsData = payload.line_items.map((item: any) => ({
      productKey: item.variant_id.toString(),
      unit_price: item.price,
      quantity: item.quantity,
    }))

    const purchasedItemsData: PurchasedItemsEvent = {
      GeneralInfo: {
        eventName: "PurchasedItems",
        siteId: shop.siteId,
        datetime: Date.now(),
        cookies: {
          sc: eventData.sc
        },
        ...customerData
      },
      TrackedOrderId: uuidv4(),
      PurchasedItems: {
        Products: productsData,
        OrderNumber: payload.id.toString()
      }
    }

    await sendPurchasedItemsEvent({
      apiKey: shop.apiKey,
      purchasedItemsData
    })
  } catch (error) {
    console.error(error);
  }
}
