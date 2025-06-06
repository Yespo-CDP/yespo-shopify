import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";
import {Contact} from "~/@types/contact";

export const createContact = async ({
                                            apiKey,
                                            contactData
                                          }: {
  apiKey: string;
  contactData: Contact
}): Promise<void> => {
  console.log('CREATE CONTACT REQUEST DATA', JSON.stringify(contactData, null, 2));
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
    console.log('CREATE CONTACT RESPONSE', JSON.stringify(response, null, 2));
    return response;
  } catch (error: any) {
    console.error("Error creating contact:", error?.message);
    if (!error?.message?.includes('Duplicated request')) {
      throw new Error(error.message);
    }
  }
};
