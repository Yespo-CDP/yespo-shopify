/**
 * In-memory sliding-window rate limiter for Yespo API requests.
 *
 * Yespo limit: 60 requests per minute per siteId.
 *
 * Call `throttleApiRequest(siteId)` before every HTTP request to the
 * Yespo API. If the window is full the function awaits until a slot
 * becomes available, then records the new timestamp and returns.
 *
 * NOTE: This implementation is per-process. For multi-worker deployments
 * replace the in-memory Map with a Redis-backed counter.
 */

const requestLog = new Map<string, number[]>();

/**
 * Blocks until a request slot is available for the given siteId.
 *
 * @param siteId - Yespo siteId (the rate-limit key).
 * @param maxPerMinute - Maximum requests per 60-second window (default 60).
 */
export async function throttleApiRequest(
  siteId: string,
  maxPerMinute = 60,
): Promise<void> {
  const now = Date.now();
  const windowMs = 60_000;

  const timestamps = requestLog.get(siteId) ?? [];
  // Prune entries that have fallen outside the rolling window.
  const recent = timestamps.filter((ts) => ts > now - windowMs);

  if (recent.length >= maxPerMinute) {
    // Wait until the oldest in-window request ages out, plus a small buffer.
    const waitMs = recent[0] + windowMs - now + 50;
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    // Re-enter to pick up any concurrent requests that may have been added
    // while we were waiting.
    return throttleApiRequest(siteId, maxPerMinute);
  }

  recent.push(now);
  requestLog.set(siteId, recent);
}
