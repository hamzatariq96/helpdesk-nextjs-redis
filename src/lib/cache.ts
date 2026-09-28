import { redis } from "./redis";

export const CacheKeys = {
  dashboard: "dashboard:stats",
  report: "reports:summary",
} as const;

/** Cache-aside: read from Redis, fall back to the loader, store the result with a TTL. */
export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const redisKey = `cache:${key}`;
  const hit = await redis.get(redisKey);
  if (hit !== null) return JSON.parse(hit) as T;

  const value = await load();
  await redis.set(redisKey, JSON.stringify(value), "EX", ttlSeconds);
  return value;
}

/** Called after every write that could change a cached aggregate. */
export async function invalidate(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await redis.del(...keys.map((key) => `cache:${key}`));
}
