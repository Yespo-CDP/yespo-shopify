import type { Contact } from "~/@types/contact";
import {
  shopRepository,
  customerSyncRepository,
  customerSyncLogRepository,
} from "~/repositories/repositories.server";
import { updateContacts } from "~/api/update-contacts";
import { createClient } from "../services/create-client";
import type { OfflineTokenManager } from "../services/offline-token-manager";
import { getCustomers } from "../services/get-customers";
import { getCustomersCount } from "../services/get-customers-count";
import { createContactPayload } from "../services/create-contact-payload";
import { fetchContactMarketContext } from "~/services/fetch-contact-market-context.server";
import {sendLogEvent} from "~/api/send-log-event";
import {EVENT_MESSAGES} from "~/config/constants";
import { normalizeYespoItems } from "~/utils/normalize-yespo-items";

const CUSTOMERS_CHUNK_SIZE = 200; // Shopify max limit 250

type FailedContacts = Partial<Contact> | Partial<Contact>[] | undefined;

const getChannelKeys = (contact: Partial<Contact> | null | undefined) => {
  const channels = normalizeYespoItems(contact?.channels)
    .map((channel) => ({
      type: channel?.type,
      value: String(channel?.value ?? "").trim(),
    }))
    .filter((channel) => channel.value);

  return {
    hasChannels: channels.length > 0,
    emails: channels
      .filter((channel) => channel.type === "email")
      .map((channel) => channel.value.toLowerCase()),
    phones: channels
      .filter((channel) => channel.type === "sms")
      .map((channel) => channel.value.replace(/\D/g, ""))
      .filter(Boolean),
  };
};

/**
 * Yespo returns rejected contacts without externalCustomerId, so match them by
 * email, then by phone. A contact rejected without channels matches every sent
 * contact without an email or phone digits. If any rejected contact matches
 * nothing, or fewer contacts are matched than rejected, all sent contacts are
 * returned, because any of them could be the rejected one.
 */
const getRejectedIndexes = (
  contactsData: Contact[],
  failedContacts: FailedContacts,
): Set<number> => {
  const failedItems = normalizeYespoItems(failedContacts || undefined);
  const sentKeys = contactsData.map(getChannelKeys);
  const rejectedIndexes = new Set<number>();
  const findSent = (isMatch: (sent: (typeof sentKeys)[number]) => boolean) =>
    [...sentKeys.keys()].filter((index) => isMatch(sentKeys[index]));

  for (const failedContact of failedItems) {
    const failed = getChannelKeys(failedContact);

    let matched = failed.hasChannels
      ? findSent((sent) => sent.emails.some((val) => failed.emails.includes(val)))
      : findSent((sent) => !sent.emails.length && !sent.phones.length);

    if (matched.length === 0) {
      matched = findSent((sent) =>
        sent.phones.some((val) => failed.phones.includes(val)),
      );
    }

    if (matched.length === 0) {
      return new Set(contactsData.keys());
    }

    matched.forEach((index) => rejectedIndexes.add(index));
  }

  return rejectedIndexes.size < failedItems.length
    ? new Set(contactsData.keys())
    : rejectedIndexes;
};

/**
 * Syncs customer list from Shopify with contact list in Yespo.
 *
 * This handler synchronizes all customers available in Shopify with Yespo contacts.
 * Synchronization occurs in a cycle with chunks of 200 pieces (`CUSTOMERS_CHUNK_SIZE`).
 * Based on the `CustomerSync` table in the database, we check the contacts that have
 * already been synchronized and filter them out.
 *
 *
 * @param {any} shop - The unique URL identifier of the shop.
 * @param {string} accessToken - Access token from shopify session.
 * @param {string} apiKey - The API key to connect with the account.
 * @param {string} shopId - The unique shop id in our database.
 *
 * @returns {Promise<void>} A promise that resolves once the synchronization has been complete or logs an error on failure.
 *
 * @example
 * await customerSyncHandler(
 *   shop,
 *   accessToken,
 *   shopData.apiKey,
 *   shopData.id
 * );
 */

export const customerSyncHandler = async (
  shop: string,
  accessToken: string,
  apiKey: string,
  shopId: number,
  orgId?: number | null,
  tokenManager?: OfflineTokenManager,
) => {
  console.log(`⏳ Synchronizing customers start for ${shop}`);

  const shopRecord = await shopRepository.getShop(shop);
  const logDomain = shopRecord?.domain || shop;
  const marketContext = await fetchContactMarketContext(shop);

  const client = createClient({ shop, accessToken, tokenManager });
  const customersCount = await getCustomersCount({ client });

  let cursor: string | null | undefined = null;
  let totalSkippedCount = 0;
  let totalFailedCount = 0;
  let totalSyncedCount = 0;

  try {
    do {
      try {
        const shopData = await shopRepository.getShop(shop);

        if (shopData?.isContactSyncEnabled) {
          const response = await getCustomers({
            client,
            count: CUSTOMERS_CHUNK_SIZE,
            cursor,
          });
          const customers = response.customers;
          cursor = response.cursor;

          const customerIds = customers.map((customer) => customer.id);
          const customerSyncs =
            await customerSyncRepository.getCustomerSyncByCustomerIds(
              shopId,
              customerIds,
            );

          const contactsData: Contact[] = [];
          const sentCustomers: typeof customers = [];

          let chunkSkippedCount = 0;
          let chunkFailedCount = 0;

          for (const customer of customers) {
            const customerSync = customerSyncs.find(
              (val) => val.customerId === customer.id,
            );

            const customerUpdatedDate =
              new Date(customer.updatedAt)?.getTime() ?? 0;
            const customerSyncUpdatedDate =
              customerSync?.updatedAt?.getTime() ?? 0;

            if (customerUpdatedDate > customerSyncUpdatedDate) {
              const contact = createContactPayload(customer, marketContext);
              contactsData.push(contact);
              sentCustomers.push(customer);
            } else {
              chunkSkippedCount++;
            }
          }

          if (contactsData?.length > 0) {
            const contactsUpdateResponse = await updateContacts({
              apiKey,
              contactsData,
              domain: logDomain,
              orgId
            });

            if (contactsUpdateResponse?.failedContacts) {
              if (Array.isArray(contactsUpdateResponse?.failedContacts)) {
                chunkFailedCount =
                  contactsUpdateResponse?.failedContacts?.length;
              } else {
                chunkFailedCount = 1;
              }
            }

            let rejectedIndexes = getRejectedIndexes(
              contactsData,
              contactsUpdateResponse?.failedContacts as FailedContacts,
            );

            if (contactsUpdateResponse?.errorMessage) {
              console.error(
                "Error customers sync in chunk, Yespo errorMessage:",
                contactsUpdateResponse.errorMessage,
              );
              chunkFailedCount = contactsData.length;
              rejectedIndexes = new Set(contactsData.keys());
            }

            for (const [index, customer] of sentCustomers.entries()) {
              if (rejectedIndexes.has(index)) {
                continue;
              }

              await customerSyncRepository.createOrUpdateCustomerSync({
                customerId: customer.id,
                createdAt: customer.createdAt,
                updatedAt: customer.updatedAt,
                shop: {
                  connect: {
                    id: shopId,
                  },
                },
              });
            }
          }

          totalFailedCount += chunkFailedCount;
          totalSkippedCount += chunkSkippedCount;
          totalSyncedCount += contactsData?.length - chunkFailedCount;

          await sendLogEvent({
            orgId,
            errorMessage: '',
            data: {
              domain: logDomain,
              offset: CUSTOMERS_CHUNK_SIZE,
              responseBody: contactsData,
              statusCode: 200
            },
            message: EVENT_MESSAGES.SEND_CONTACTS_BULK_SUCCESS,
            logLevel: 'INFO'
          })

          await customerSyncLogRepository.createOrUpdateCustomerSyncLog({
            status: "IN_PROGRESS",
            skippedCount: totalSkippedCount,
            failedCount: totalFailedCount,
            syncedCount: totalSyncedCount,
            totalCount: customersCount,
            shop: {
              connect: {
                id: shopId,
              },
            },
          });
        } else {
          console.log(`⚠️ Synchronization customers cancelled for ${shop}`);
          cursor = null;
        }
      } catch (error: any) {
        console.error("Error customers sync in chunk", error);

        await sendLogEvent({
          orgId,
          errorMessage: `Error bulk customers sync ${error?.message}`,
          data: {
            domain: logDomain,
            offset: CUSTOMERS_CHUNK_SIZE,
            responseBody: {},
            statusCode: error?.status ?? 400
          },
          message: EVENT_MESSAGES.SEND_CONTACTS_BULK_FAILED,
          logLevel: 'ERROR'
        })

        throw Error(error);
      }
    } while (cursor);


    await customerSyncLogRepository.createOrUpdateCustomerSyncLog({
      status: "COMPLETE",
      skippedCount: totalSkippedCount,
      failedCount: totalFailedCount,
      syncedCount: totalSyncedCount,
      totalCount: customersCount,
      shop: {
        connect: {
          id: shopId,
        },
      },
    });

    console.log(`✅ Synchronizing customers finish for ${shop}`);
  } catch (error: any) {
    console.error("Synchronization error", error);
    await customerSyncLogRepository.createOrUpdateCustomerSyncLog({
      status: "ERROR",
      skippedCount: totalSkippedCount,
      failedCount: totalFailedCount,
      syncedCount: totalSyncedCount,
      totalCount: customersCount,
      shop: {
        connect: {
          id: shopId,
        },
      },
    });

    return;
  }
};
