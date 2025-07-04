import {getAuthHeader} from "~/utils/auth";
import {fetchWithErrorHandling} from "~/utils/fetchWithErrorHandling";
import type {PurchasedItemsEvent} from "~/@types/purchasedItems";

export const sendPurchasedItemsEvent = async ({
  apiKey,
  purchasedItemsData
}: {
  apiKey: string;
  purchasedItemsData: PurchasedItemsEvent
}): Promise<void> => {
  const url = `${process.env.WEB_TRACKER_URL}`;
  const authHeader = getAuthHeader(apiKey);
  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(purchasedItemsData),
  };

  try {
    await fetchWithErrorHandling(url, options);
  } catch (error: any) {
    console.error("Error sending purchased items:", error?.message);
  }
};
