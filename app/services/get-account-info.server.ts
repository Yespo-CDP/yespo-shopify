import type { Account } from "~/@types/account";
import { getAuthHeader } from "~/utils/auth";

const getAccountInfoService = async ({
  apiKey,
}: {
  apiKey: string;
}): Promise<Account> => {
  const url = `${process.env.API_URL}/account/info`;
  const authHeader = getAuthHeader(apiKey);
  const options = {
    method: "GET",
    headers: {
      accept: "application/json; charset=UTF-8",
      Authorization: authHeader,
    },
  };

  try {
    const response = await fetch(url, options);
    const responseParse = (await response.json()) as Account;

    if (response.status === 401) {
      throw new Error("invalidApiKey");
    }

    if (!response.ok) {
      throw new Error("unknownError");
    }

    return responseParse;
  } catch (error: any) {
    const message = error?.message ?? "unknownError";
    throw new Error(message);
  }
};

export default getAccountInfoService;
