/**
 * Custom error class to represent HTTP fetch errors.
 *
 * Extends the built-in Error class by adding an HTTP status code.
 */
class FetchError extends Error {
  status: number;

  /**
   * Creates a new FetchError instance.
   *
   * @param {string} message - The error message.
   * @param {number} status - The HTTP status code associated with the error.
   */
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Performs a fetch request with enhanced error handling.
 *
 * Sends an HTTP request to the given URL with optional fetch options.
 * Parses the response as JSON if possible, otherwise returns raw text.
 * Throws a `FetchError` if the response status is not OK (status code 2xx).
 * Wraps unexpected errors into a `FetchError` with status 500.
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
  try {
    const response = await fetch(url, options);

    const rawResponse = await response.text();
    let responseData: any = rawResponse;

    try {
      responseData = JSON.parse(rawResponse);
    } catch (e) {}

    if (!response.ok) {
      const message =
        typeof responseData === "string"
          ? responseData
          : responseData?.message || "Unknown error";
      throw new FetchError(message, response.status);
    }

    return responseData;
  } catch (error: any) {
    if (error instanceof FetchError) {
      throw error;
    }
    throw new FetchError(error.message || "Unexpected error", 500);
  }
}
