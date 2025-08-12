import type { Contact } from "~/@types/contact";
import {
  customerSyncRepository,
  customerSyncLogRepository,
} from "~/repositories/repositories.server";
import { updateContacts } from "~/api/update-contacts";
import { createClient } from "../services/create-client";
import { getCustomers } from "../services/get-customers";
import { getCustomersCount } from "../services/get-customers-count";
import { getContactByCustomer } from "../services/get-contact-by-customer";

const CUSTOMERS_CHUNK_SIZE = 200; // Shopify max limit 250

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
) => {
  const customerSyncLog =
    await customerSyncLogRepository.getCustomerSyncLogByShop(shop);

  if (customerSyncLog?.status === "IN_PROGRESS") {
    console.log(`⚠️ Synchronization already running for ${shop}`);
    return;
  }

  console.log(`⏳ Synchronizing customers start for ${shop}`);
  console.log("shop", shop);
  console.log("accessToken", accessToken);

  const client = createClient({ shop, accessToken });
  const customersCount = await getCustomersCount({ client });
  console.log("Total customers count", customersCount, "\n");

  await customerSyncLogRepository.createOrUpdateCustomerSyncLog({
    status: "IN_PROGRESS",
    skippedCount: 0,
    syncedCount: 0,
    failedCount: 0,
    totalCount: customersCount,
    shop: {
      connect: {
        id: shopId,
      },
    },
  });

  let cursor: string | null | undefined = null;
  let totalSkippedCount = 0;
  let totalFailedCount = 0;
  let totalSyncedCount = 0;

  try {
    do {
      try {
        console.log("\n", "Chunk start:");
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
            customerIds,
          );

        const contactsData: Contact[] = [];

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
            const contact = getContactByCustomer(customer);
            contactsData.push(contact);

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
          } else {
            chunkSkippedCount++;
          }
        }

        if (contactsData?.length > 0) {
          const contactsUpdateResponse = await updateContacts({
            apiKey,
            contactsData,
          });

          if (contactsUpdateResponse?.failedContacts) {
            if (Array.isArray(contactsUpdateResponse?.failedContacts)) {
              chunkFailedCount = contactsUpdateResponse?.failedContacts?.length;
            } else {
              chunkFailedCount = 1;
            }
          }
        }

        totalFailedCount += chunkFailedCount;
        totalSkippedCount += chunkSkippedCount;
        totalSyncedCount += contactsData?.length - chunkFailedCount;

        console.log("Total customers in chunk:", customers?.length);
        console.log("Total skipped customers in chunk:", chunkSkippedCount);
        console.log("Total sent customers to sync:", contactsData?.length);
        console.log("Total failed customers sync:", chunkFailedCount);

        await customerSyncLogRepository.createOrUpdateCustomerSyncLog({
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
      } catch {
        console.error("Error customers sync in chunk");
        await customerSyncLogRepository.createOrUpdateCustomerSyncLog({
          status: "ERROR",
          shop: {
            connect: {
              id: shopId,
            },
          },
        });
        cursor = null;
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
  } catch (error) {
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
