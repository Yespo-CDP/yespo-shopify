const username = "yespo-app";

const getScript = async ({ apiKey }: { apiKey: string }): Promise<string> => {
  const url = `${process.env.API_URL}/site/script`;
  const authHeader = `Basic ${Buffer.from(`${username}:${apiKey}`).toString("base64")}`;
  const options = {
    method: "GET",
    headers: {
      accept: "text/plain",
      Authorization: authHeader,
    },
  };

  try {
    const response = await fetch(url, options);
    const responseParse = await response.text();

    if (!response.ok) {
      throw new Error("requestScriptError");
    }

    return responseParse;
  } catch (error: any) {
    throw new Error("requestScriptError");
  }
};

export default getScript;
