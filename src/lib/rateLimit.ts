import { redis } from "./redis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window counter. SET NX starts the window with its expiry and INCR counts
 * the hit, all in one MULTI, so there's no gap where a key exists without a TTL.
 */
export async function hitRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const redisKey = `ratelimit:${key}`;
  const results = (await redis
    .multi()
    .set(redisKey, 0, "EX", windowSeconds, "NX")
    .incr(redisKey)
    .ttl(redisKey)
    .exec()) as [unknown, [Error | null, number], [Error | null, number]];

  const count = results[1][1];
  const ttl = results[2][1];
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: count <= limit ? 0 : Math.max(ttl, 1),
  };
}

export async function resetRateLimit(key: string): Promise<void> {
  await redis.del(`ratelimit:${key}`);
}
