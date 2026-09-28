import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: Redis };

// lazyConnect: nothing connects at import time (e.g. during `next build`);
// the first command opens the connection.
export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL ?? "redis://localhost:6379/0", {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
  });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

/** Pub/sub needs its own connection: a subscribed connection can't run other commands. */
export function createSubscriber(): Redis {
  return redis.duplicate();
}
