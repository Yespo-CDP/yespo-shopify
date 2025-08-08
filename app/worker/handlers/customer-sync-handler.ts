import { customerSyncRepository } from "~/repositories/repositories.server";
import { createClient } from "../services/create-client";
import { getCustomers } from "../services/get-customers";

export const customerSyncHandler = async (
  shop: string,
  accessToken: string,
) => {
  console.log(`⏳ Synchronizing customers in ${shop}`);
  console.log("shop", shop);
  console.log("accessToken", accessToken, "\n\n");

  const client = createClient(shop, accessToken);

  let cursor: string | null | undefined = null;

  do {
    try {
      const response = await getCustomers({ client, count: 2, cursor });
      const customers = response.customers;
      cursor = response.cursor;
      const customerIds = customers.map((customer) => customer.id);

      const customerSyncs =
        await customerSyncRepository.getCustomerSyncByCustomerIds(customerIds);

      console.log("customers", response);
      console.log("Customers sync", customerSyncs);
    } catch {
      console.error("Error customers sync in chunk");
    }
  } while (cursor);
};
