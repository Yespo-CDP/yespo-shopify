import Redis from "ioredis";

import { redisConfig } from "~/config/redis";

/**
 * Redis-backed sliding-window rate limiter for Yespo API requests.
 *
 * Yespo limit: 60 requests per minute per siteId.
 *
 * Call `throttleApiRequest(siteId)` before every HTTP request to the Yespo API.
 * State lives in Redis (a sorted set of request timestamps per siteId), so the
 * limit is shared across all worker processes — unlike the previous in-memory
 * implementation, which counted requests per-process only.
 *
 * If Redis is unreachable the limiter fails open (logs a warning and allows the
 * request) so a Redis blip never hard-blocks the sync pipeline.
 */

const WINDOW_MS = 60_000;
const KEY_PREFIX = "yespo:ratelimit:";

/**
 * Atomic sliding-window check.
 *
 * KEYS[1] = sorted-set key. ARGV: now (ms), window (ms), max, unique member.
 * Drops timestamps older than the window, then either records the new request
 * and returns 0 (allowed) or returns the ms to wait until the oldest in-window
 * request ages out (throttled).
 */
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)

if count < max then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, window)
  return 0
end

local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local oldestScore = tonumber(oldest[2])
local wait = oldestScore + window - now
if wait < 0 then
  return 0
end
return wait
`;

let client: Redis | null = null;

function getRedis(): Redis {
  if (!client) {
    const url = redisConfig.url ?? "";
    const isSecure = url.startsWith("rediss://");
    client = new Redis(url, {
      maxRetriesPerRequest: null,
      ...(isSecure ? { tls: { rejectUnauthorized: false } } : {}),
    });
    client.on("error", (error) => {
      console.error("Rate limiter Redis error:", error?.message);
    });
  }
  return client;
}

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
  const redis = getRedis();
  const key = `${KEY_PREFIX}${siteId}`;

  for (;;) {
    const now = Date.now();
    const member = `${now}-${Math.random().toString(36).slice(2)}`;

    let waitMs: number;
    try {
      waitMs = (await redis.eval(
        SLIDING_WINDOW_SCRIPT,
        1,
        key,
        now,
        WINDOW_MS,
        maxPerMinute,
        member,
      )) as number;
    } catch (error) {
      // Fail open: never let a Redis issue hard-block the sync pipeline.
      console.warn(
        `Rate limiter unavailable, allowing request for ${siteId}:`,
        (error as Error)?.message,
      );
      return;
    }

    if (waitMs <= 0) {
      return;
    }

    // Wait until the oldest in-window request ages out, plus a small buffer.
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs + 50));
  }
}
