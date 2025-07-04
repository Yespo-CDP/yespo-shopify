import {eventDataRepository} from "~/repositories/repositories.server";
import type {Shop} from "~/@types/shop";
import { v4 as uuidv4 } from 'uuid';
import type {ICartCustomer, StatusCartEvent} from "~/@types/statusCart";
import {buildCustomerData} from "~/utils/buildCustomerData";
import {sendStatusCartEvent} from "~/api/send-status-cart-event";

/**
 * Sends status cart event data to the tracking service based on the given payload and shop.
 *
 * Retrieves event data for the cart token, builds customer and product data,
 * then sends the status cart event to the external API using the shop's API key.
 * If required data is missing (event data, API key, or site ID), the function returns early.
 *
 * @async
 * @function sendStatusCartService
 * @param {any} payload - The webhook payload containing cart and line item details.
 * @param {Shop} shop - The shop object containing API key and site ID.
 * @returns {Promise<void>} Resolves when the status cart event has been sent or if an error occurs.
 *
 * @example
 * await sendStatusCartService(webhookPayload, shop);
 */
export const sendStatusCartService = async (payload: any, shop: Shop) => {
  try {
    const eventData = await eventDataRepository.getEventData(payload.token)

    if (!eventData || !shop.apiKey || !shop.siteId) {
      return null
    }

    const customerData: ICartCustomer = buildCustomerData(eventData.customer)

    const productsData = payload.line_items.map((item: any) => ({
      productKey: item.id.toString(),
      price: item.price,
      discount: (Number(item.total_discount) / Number(item.quantity)).toFixed(2),
      quantity: item.quantity,
      price_currency_code: item.price_set.shop_money.currency_code
    }))

    const cartEventData: StatusCartEvent = {
      GeneralInfo: {
        eventName: "StatusCart",
        siteId: shop.siteId,
        datetime: Date.now(),
        cookies: {
          sc: eventData.sc
        },
          ...customerData
      },
      StatusCart: {
        GUID: uuidv4(),
        Products: productsData
      }
    }

    await sendStatusCartEvent({
      apiKey: shop.apiKey,
      cartEventData
    })
  } catch (error: any) {
    console.error(error);
  }
}
