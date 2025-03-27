import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";

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
    const response = (await fetchWithErrorHandling(
      url,
      options,
    )) as WebPushDomainResponse;

    return { result: response?.success?.status ?? "ok" };
  } catch (error: any) {
    console.error("Error creating webpush domain:", error?.message);
    if (error?.message?.includes("Domain is already registered")) {
      throw new Error("domainAlreadyRegisteredError");
    } else {
      throw new Error("createWebPushDomainError");
    }
  }
};
