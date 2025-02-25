import type { Account } from "~/@types/account";

const username = "yespo-app";

const getAccountInfo = async ({
  apiKey,
}: {
  apiKey: string;
}): Promise<Account> => {
  const url = `${process.env.API_URL}/account/info`;
  const authHeader = `Basic ${Buffer.from(`${username}:${apiKey}`).toString("base64")}`;
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

export default getAccountInfo;
