import {
  RATE_LIMIT_DEFAULT_RETRY_AFTER_MS,
  RATE_LIMIT_MAX_RETRIES,
} from "~/config/constants";

/**
 * Custom error class to represent HTTP fetch errors.
 *
 * Extends the built-in Error class by adding an HTTP status code.
 */
class FetchError extends Error {
  status: number;
  responseData?: unknown;

  /**
   * Creates a new FetchError instance.
   *
   * @param {string} message - The error message.
   * @param {number} status - The HTTP status code associated with the error.
   * @param {unknown} [responseData] - Parsed response body, when available.
   */
  constructor(message: string, status: number, responseData?: unknown) {
    super(message);
    this.status = status;
    this.responseData = responseData;
  }
}

/**
 * Builds a readable fetch error from an HTTP status and parsed body.
 *
 * Yespo often returns Spring-style JSON (`{ status, error, path }`) or even `{}`
 * with no `message` field. Falling back to "Unknown error" hides the status.
 */
const formatFetchErrorMessage = (
  responseData: unknown,
  status: number,
): string => {
  if (typeof responseData === "string" && responseData.trim()) {
    return `HTTP ${status}: ${responseData}`;
  }

  if (responseData && typeof responseData === "object") {
    const data = responseData as Record<string, unknown>;
    const detail = [data.message, data.error, data.code].find(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    if (detail) {
      return `HTTP ${status}: ${detail}`;
    }

    const json = JSON.stringify(responseData);
    if (json && json !== "{}") {
      return `HTTP ${status}: ${json}`;
    }
  }

  return `HTTP ${status}`;
};

/**
 * Pauses execution for the given number of milliseconds.
 *
 * @param {number} ms - Delay in milliseconds.
 * @returns {Promise<void>} Resolves after the delay.
 */
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Parses the `Retry-After` header into milliseconds.
 *
 * Supports both the delay-seconds form (e.g. `"120"`) and the HTTP-date form
 * (e.g. `"Wed, 21 Oct 2026 07:28:00 GMT"`). Falls back to
 * `RATE_LIMIT_DEFAULT_RETRY_AFTER_MS` when the header is missing or unparseable.
 *
 * @param {string | null} headerValue - Raw `Retry-After` header value.
 * @returns {number} Wait time in milliseconds (never negative).
 */
const parseRetryAfterMs = (headerValue: string | null): number => {
  if (!headerValue) {
    return RATE_LIMIT_DEFAULT_RETRY_AFTER_MS;
  }

  const seconds = Number(headerValue);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const dateMs = Date.parse(headerValue);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return RATE_LIMIT_DEFAULT_RETRY_AFTER_MS;
};

/**
 * Performs a fetch request with enhanced error handling.
 *
 * Sends an HTTP request to the given URL with optional fetch options.
 * Parses the response as JSON if possible, otherwise returns raw text.
 * Throws a `FetchError` if the response status is not OK (status code 2xx).
 * Wraps unexpected errors into a `FetchError` with status 500.
 *
 * On HTTP `429` (Rate Limited) the request is retried up to
 * `RATE_LIMIT_MAX_RETRIES` times, waiting for the duration advertised by the
 * `Retry-After` header (or `RATE_LIMIT_DEFAULT_RETRY_AFTER_MS` when absent)
 * before each retry. If every attempt is rate limited, the last `429` is thrown.
 *
 * @param {string} url - The URL to fetch.
 * @param {RequestInit} [options] - Optional fetch options.
 * @returns {Promise<any>} The parsed JSON response or raw text if JSON parsing fails.
 *
 * @throws {FetchError} When the response status is not OK or on unexpected errors.
 */

export async function fetchWithErrorHandling(
  url: string,
  options?: RequestInit,
) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, options);

      const rawResponse = await response.text();
      let responseData: any = rawResponse;

      try {
        responseData = JSON.parse(rawResponse);
      } catch (e) {}

      if (response.status === 429 && attempt < RATE_LIMIT_MAX_RETRIES) {
        const waitMs = parseRetryAfterMs(response.headers.get("retry-after"));
        console.warn(
          `Rate limited (429) on ${url}. Retrying in ${waitMs}ms ` +
            `(attempt ${attempt + 1}/${RATE_LIMIT_MAX_RETRIES}).`,
        );
        await delay(waitMs);
        continue;
      }

      if (!response.ok) {
        throw new FetchError(
          formatFetchErrorMessage(responseData, response.status),
          response.status,
          responseData,
        );
      }

      return {
        responseData,
        status: response.status,
      };
    } catch (error: any) {
      if (error instanceof FetchError) {
        throw error;
      }
      throw new FetchError(error.message || "Unexpected error", 500);
    }
  }
}
