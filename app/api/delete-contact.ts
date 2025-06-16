import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";

export const deleteContact = async ({
                                      apiKey,
                                      externalCustomerId,
                                      erase = false
                                    }: {
  apiKey: string;
  externalCustomerId: string,
  erase: boolean
}): Promise<void> => {
  console.log('DELETE CONTACT REQUEST EXTERNAL ID', externalCustomerId )
  const url = `${process.env.API_URL}/contact?externalCustomerId=${externalCustomerId}&erase=${erase}`;
  const authHeader = getAuthHeader(apiKey);
  const options = {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      Authorization: authHeader,
    },
  };

  try {
    const response = await fetchWithErrorHandling(url, options);
    console.log('DELETE CONTACT RESPONSE DATA',  JSON.stringify(response, null, 2));
    return response;
  } catch (error: any) {
    console.error("Error deleting contact:", error?.message);
    if (!error?.message.includes('not found')) {
      throw new Error(error.message);
    }
  }
};
