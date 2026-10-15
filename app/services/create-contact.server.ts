import { createContact } from "~/api/create-contact";
import { customerSyncRepository } from "~/repositories/repositories.server";
import {
  contactMarketId,
  shouldTrackMarketId,
} from "~/services/market-tracking";
import { loadStorefrontHostCount } from "~/services/resolve-tracking-market-id.server";

/**
 * Creates a contact using the provided payload and API key.
 *
 * Extracts email and phone from the payload,
 * constructs contact data with first and last names and external customer ID,
 * and calls `createContact` service to create the contact in the system.
 *
 * Any errors during the process are caught and logged.
 *
 * **Shopify Customer Webhook (REST):**
 * https://shopify.dev/docs/api/admin-rest/latest/resources/customer#resource-object
 *
 * **Yespo Add Contact API:**
 * https://docs.esputnik.com/reference/addcontact-1
 *
 * **Field Mapping:**
 * - `payload.id` → `externalCustomerId`
 * - `payload.first_name` → `firstName`
 * - `payload.last_name` → `lastName`
 * - `payload.email` → `channels[type=email].value`
 * - `payload.phone` → `channels[type=sms].value`
 * - `payload.default_address.country_code` → `marketId` (when the shop has more than one storefront)
 * - `payload.admin_graphql_api_id` → `customerId` (for db sync log)
 * - `payload.created_at` → `createdAt` (for db sync log)
 * - `payload.updated_at` → `updatedAt` (for db sync log)
 *
 * @param {any} payload - The customer data payload containing contact info.
 * @param {string} apiKey - The API key used for authentication with the contact service.
 * @param {string} shopId - The shop id for connect customer sync log to shop.
 * @returns {Promise<void>} A promise that resolves when the contact creation completes.
 */
export const createContactService = async (
  payload: any,
  apiKey: string,
  shopId: number,
  shopUrl: string,
  orgId?: number | null,
  myshopifyDomain?: string,
) => {
  try {
    const channels = [];

    if (payload.email) {
      channels.push({
        type: "email",
        value: payload.email,
      });
    }

    if (payload.phone) {
      channels.push({
        type: "sms",
        value: payload.phone,
      });
    }

    const countryCode = payload.default_address?.country_code ?? null;
    const hostCount = await loadStorefrontHostCount(myshopifyDomain || "");
    const marketId = contactMarketId(
      countryCode,
      shouldTrackMarketId(hostCount),
    );
    console.log("[contact marketId] create", {
      shop: myshopifyDomain || shopUrl,
      customerId: payload.id,
      countryCode,
      hostCount,
      marketId: marketId ?? null,
    });

    const contactData = {
      firstName: payload.first_name || "",
      lastName: payload.last_name || "",
      channels,
      externalCustomerId: payload.id.toString(),
      ...(marketId ? { marketId } : {}),
    };

    await createContact({
      apiKey,
      contactData,
      domain: shopUrl,
      orgId,
    });

    await customerSyncRepository.createOrUpdateCustomerSync({
      customerId: payload.admin_graphql_api_id,
      createdAt: payload.created_at,
      updatedAt: payload.updated_at,
      shop: {
        connect: {
          id: shopId,
        },
      },
    });
  } catch (error: any) {
    console.error("Error occurred in Create Contact Service", error);
  }
};
