import type { ConnectionOptions } from "bullmq";
import dotenv from "dotenv";
import IORedis from "ioredis";

dotenv.config();

const redisUrl = process.env.REDIS_URL ?? "";
const isSecure = redisUrl.startsWith("rediss://");

/**
 * Single ioredis client shared by every BullMQ Queue/Worker and the rate
 * limiter in this process. Heroku Redis plans cap total client connections, so
 * each Queue must not open its own socket; BullMQ Workers still duplicate this
 * client for their blocking connection.
 */
export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.max(Math.min(Math.exp(times), 20_000), 1_000),
  ...(isSecure && {
    tls: {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined,
    },
  }),
});

redisConnection.on("error", (error) => {
  console.error("[redis] shared connection error:", error?.message);
});

/**
 * Same client typed for BullMQ, which pins its own nested ioredis version;
 * BullMQ detects client instances by duck typing, so this is safe at runtime.
 */
export const bullmqConnection = redisConnection as unknown as ConnectionOptions;
