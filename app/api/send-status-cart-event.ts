import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";
import type {StatusCartEvent} from "~/@types/statusCart";

export const sendStatusCartEvent = async ({
 apiKey,
 cartEventData
}: {
  apiKey: string;
  cartEventData: StatusCartEvent
}): Promise<void> => {
  const url = `${process.env.WEB_TRACKER_URL}`;
  const authHeader = getAuthHeader(apiKey);
  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(cartEventData),
  };

  try {
    await fetchWithErrorHandling(url, options);
  } catch (error: any) {
    console.error("Error sending status cart:", error?.message);
    if (!error?.message?.includes('Duplicated request')) {
      throw new Error(error.message);
    }
  }
};
