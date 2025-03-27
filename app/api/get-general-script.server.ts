import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";

export const getGeneralScript = async ({ apiKey }: { apiKey: string }) => {
  const url = `${process.env.API_URL}/site/script`;
  const authHeader = getAuthHeader(apiKey);
  const options = {
    method: "GET",
    headers: {
      accept: "text/plain",
      Authorization: authHeader,
    },
  };

  try {
    const response = await fetchWithErrorHandling(url, options);

    return response;
  } catch (error: any) {
    console.error("Error fetching general script:", error);
    throw new Error("requestScriptError");
  }
};
