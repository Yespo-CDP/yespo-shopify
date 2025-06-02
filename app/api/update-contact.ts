import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";
import {Contact} from "~/@types/contact";

export const updateContact = async ({
                                      apiKey,
                                      contactData
                                    }: {
  apiKey: string;
  contactData: Contact
}): Promise<{ result: string }> => {
  const url = `${process.env.API_URL}/contact`;
  const authHeader = getAuthHeader(apiKey);
  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(contactData),
  };

  try {
    const response = await fetchWithErrorHandling(url, options);
    return response;
  } catch (error: any) {
    console.error("Error updating contact:", error?.message);
    throw new Error(error.message);
  }
};
