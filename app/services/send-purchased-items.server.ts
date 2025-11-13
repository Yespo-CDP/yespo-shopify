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
    console.log('sendPurchasedItemsService payload.cart_token', payload.cart_token)
    const cartAttribute = payload.note_attributes.find(
      (attr: { name: string; value: string }) =>
        attr.name.trim().toLowerCase() === 'cart token'
    )?.value;

    console.log('cartAttribute:', cartAttribute);
    console.log('!payload.cart_token:', !payload.cart_token);
    console.log('!cartAttribute',!cartAttribute);

    const cartToken = payload.cart_token ?? cartAttribute;
    console.log('cartToken', cartToken)

    if (!cartToken) {
      console.error("Cart token doesn't exist");
      return null;
    }

    const eventData = await eventDataRepository.getEventData(cartToken)

    if (!eventData) {
      console.error('Event data not exist')
      return null
    }

    if (!shop.apiKey) {
      console.error('Api key does not provided')
      return null
    }

    if (!shop.siteId) {
      console.error('Site id does not provided')
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

    console.log('SUCCESSFULLY SEND PURCHASED ITEMS')
  } catch (error) {
    console.error("Error occurred in Send Purchased Items Service", error);
  }
}
