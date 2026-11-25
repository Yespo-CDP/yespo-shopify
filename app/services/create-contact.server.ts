import { createContact } from "~/api/create-contact";
import { customerSyncRepository } from "~/repositories/repositories.server";
import { resolveShopContactMarketId } from "~/services/fetch-contact-market-context.server";
import { isPermanentYespoError } from "~/utils/is-permanent-yespo-error";

/**
 * Creates a contact using the provided payload and API key.
 *
 * Extracts email and phone from the payload,
 * constructs contact data with first and last names and external customer ID,
 * and calls `createContact` service to create the contact in the system.
 *
 * Nothing is sent when the stored `CustomerSync.updatedAt` is newer than
 * `payload.updated_at`: a retried or late webhook must not overwrite newer data.
 *
 * A permanent Yespo error (4xx except 429) is logged and the customer is not
 * marked as synced. Any other error is thrown so the webhook job is retried.
 * "Duplicated request" is not thrown by `createContact`: it counts as success and
 * the customer is marked as synced.
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
 * - `payload.default_address.country_code` → `marketId` when that country is an enabled shop market; otherwise the shop backup region
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
    const [customerSync] =
      await customerSyncRepository.getCustomerSyncByCustomerIds(shopId, [
        payload.admin_graphql_api_id,
      ]);
    // A missing or unparsable updated_at gives NaN, so the contact is sent.
    if (
      customerSync?.updatedAt &&
      customerSync.updatedAt.getTime() > Date.parse(payload.updated_at)
    ) {
      console.log(
        `Customer ${payload.id} not sent: newer data was already synced`,
      );
      return;
    }

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
    const marketId = await resolveShopContactMarketId({
      shopUrl: myshopifyDomain || "",
      countryCode,
      whenCountryMissing: "backup",
    });
    console.log("[contact marketId] create", {
      shop: myshopifyDomain || shopUrl,
      customerId: payload.id,
      countryCode,
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
    if (!isPermanentYespoError(error)) throw error;
    console.error(
      `Yespo rejected contact ${payload.id} with HTTP ${error.status}`,
    );
  }
};
