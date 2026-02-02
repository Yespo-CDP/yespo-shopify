import { getAuthHeader } from "~/utils/auth";
import { fetchWithErrorHandling } from "~/utils/fetchWithErrorHandling";
import {sendLogEvent} from "~/api/send-log-event";
import {EVENT_MESSAGES} from "~/config/constants";

/**
 * Response structure for the web push domain creation API.
 */
interface WebPushDomainResponse {
  errors?: {
    domain: string;
    message: string;
  };
  success?: {
    domain: string;
    status: string;
  };
}

/**
 * The name of the service worker file used for web push notifications.
 * Defaults to "service-worker.js" if not specified in environment variables.
 */
const SERVICE_WORKER_NAME =
  process.env.SERVICE_WORKER_NAME ?? "service-worker.js";

/**
 * The path where the service worker is hosted.
 * Defaults to "/apps/yespo-proxy/" if not specified in environment variables.
 */
const SERVICE_WORKER_PATH =
  process.env.SERVICE_WORKER_PATH ?? "/apps/yespo-proxy/";

/**
 * Registers a domain for web push notifications with the external API.
 *
 * Sends a POST request with domain and service worker details.
 * Handles specific errors related to domain registration and reachability,
 * throwing descriptive error messages accordingly.
 *
 * @param {Object} params - The parameters object.
 * @param {string} params.apiKey - The API key used for authentication.
 * @param {string} params.domain - The domain to register for web push.
 * @returns {Promise<{ result: string }>} A promise resolving with the registration status.
 *
 * @throws Will throw specific errors:
 * - "domainAlreadyRegisteredError" if the domain is already registered.
 * - "domainCantBeReachedError" if the domain cannot be reached.
 * - "createWebPushDomainError" for other errors.
 */
export const createWebPushDomain = async ({
  apiKey,
  domain,
  orgId
}: {
  apiKey: string;
  domain: string;
  orgId?: number | null;
}): Promise<{ result: string }> => {
  const url = `${process.env.API_URL}/site/webpush/domain`;
  const authHeader = getAuthHeader(apiKey);
  const requestBody = {
      domain: `https://${domain}`,
      serviceWorkerName: SERVICE_WORKER_NAME,
      serviceWorkerPath: SERVICE_WORKER_PATH,
      serviceWorkerScope: SERVICE_WORKER_PATH,
  }
  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(requestBody),
  };

  try {
    const res = (await fetchWithErrorHandling(
      url,
      options,
    ));

    const response = res.responseData as WebPushDomainResponse;

    if (response?.errors?.message?.includes("Domain can't be reached")) {
      await sendLogEvent({
        orgId,
        errorMessage: response?.errors?.message,
        data: {
          domain,
          requestBody,
          responseBody: response,
          statusCode: res.status
        },
        message: EVENT_MESSAGES.ADD_WEB_PUSH_DOMAIN_FAILED,
        logLevel: 'ERROR'
      })

      throw new Error("Domain can't be reached");
    }

    await sendLogEvent({
      orgId,
      errorMessage: '',
      data: {
        domain,
        requestBody,
        responseBody: response,
        statusCode: res.status
      },
      message: EVENT_MESSAGES.ADD_WEB_PUSH_DOMAIN_SUCCESS,
      logLevel: 'INFO'
    })

    return { result: response?.success?.status ?? "ok" };
  } catch (error: any) {
    console.error("Error creating webpush domain:", error?.message);

    await sendLogEvent({
      orgId,
      errorMessage: error?.message,
      data: {
        domain,
        requestBody,
        responseBody: error,
        statusCode: error?.status ?? 400
      },
      message: EVENT_MESSAGES.ADD_WEB_PUSH_DOMAIN_FAILED,
      logLevel: 'ERROR'
    })

    if (error?.message?.includes("Domain is already registered")) {
      throw new Error("domainAlreadyRegisteredError");
    } else if (error?.message?.includes("Domain can't be reached")) {
      throw new Error("domainCantBeReachedError");
    } else {
      throw new Error("createWebPushDomainError");
    }
  }
};
