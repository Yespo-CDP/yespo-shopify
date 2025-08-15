import dotenv from "dotenv";

dotenv.config();

const redisUrl = process.env.REDIS_URL;
const isSecure = redisUrl?.startsWith("rediss://");

export const redisConfig = {
  url: redisUrl,
  ...(isSecure && {
    tls: {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined,
    },
  }),
};
