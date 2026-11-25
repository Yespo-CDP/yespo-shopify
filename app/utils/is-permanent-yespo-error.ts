/**
 * Tells whether a failed Yespo request would fail again when repeated.
 *
 * HTTP 4xx except 429 is permanent. 5xx, 429, network errors and timeouts
 * (`fetchWithErrorHandling` gives them status 500) and errors without a status
 * (e.g. a database error) are temporary.
 *
 * @param {unknown} error - The caught error.
 * @returns {boolean} True when the request should not be repeated.
 */
export const isPermanentYespoError = (error: unknown): boolean => {
  const status = (error as { status?: unknown } | null | undefined)?.status;
  return (
    typeof status === "number" && status >= 400 && status < 500 && status !== 429
  );
};
