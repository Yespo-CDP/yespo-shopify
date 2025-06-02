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
}): Promise<{ result: string }> => {
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
    return response;
  } catch (error: any) {
    console.error("Error deleting contact:", error?.message);
    throw new Error(error.message);
  }
};
