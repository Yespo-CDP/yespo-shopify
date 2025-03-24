import { getAuthHeader } from "~/utils/auth";

interface WebPushDomainResponse {
  errors?: {
    domain: string;
    message: string;
  }[];
  success?: {
    domain: string;
    status: string;
  };
}

const SERVICE_WORKER_NAME =
  process.env.SERVICE_WORKER_NAME ?? "service-worker.js";
const SERVICE_WORKER_PATH =
  process.env.SERVICE_WORKER_PATH ?? "/apps/yespo-proxy/";

export const createWebPushDomain = async ({
  apiKey,
  domain,
}: {
  apiKey: string;
  domain: string;
}): Promise<{ result: string }> => {
  const url = `${process.env.API_URL}/site/webpush/domains`;
  const authHeader = getAuthHeader(apiKey);
  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      domains: [
        {
          domain: `https://${domain}`,
          serviceWorkerName: SERVICE_WORKER_NAME,
          serviceWorkerPath: SERVICE_WORKER_PATH,
          serviceWorkerScope: SERVICE_WORKER_PATH,
        },
      ],
    }),
  };

  try {
    const response = await fetch(url, options);
    const responseParse = (await response.json()) as WebPushDomainResponse;

    if (!response.ok) {
      throw new Error("createWebPushDomainError");
    }

    return { result: responseParse?.success?.status ?? "ok" };
  } catch (error: any) {
    console.error(error);
    throw new Error("createWebPushDomainError");
  }
};
