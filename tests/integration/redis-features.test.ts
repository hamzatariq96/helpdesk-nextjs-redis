import { CacheKeys, cached, invalidate } from "@/lib/cache";
import { hitRateLimit, resetRateLimit } from "@/lib/rateLimit";
import { redis } from "@/lib/redis";
import { createSession, destroySession, getSession } from "@/lib/session";
import type { SessionUser } from "@/lib/types";
import { useCleanState } from "../helpers";

useCleanState();

const alice: SessionUser = { id: 1, name: "Alice", email: "alice@example.com", role: "admin" };

describe("sessions", () => {
  it("stores the user in Redis with the configured TTL", async () => {
    const id = await createSession(alice);

    expect(await getSession(id)).toEqual(alice);
    expect(await redis.ttl(`session:${id}`)).toBe(3600);
  });

  it("slides the expiry forward on every read", async () => {
    const id = await createSession(alice);
    await redis.expire(`session:${id}`, 10);

    await getSession(id);

    expect(await redis.ttl(`session:${id}`)).toBe(3600);
  });

  it("is gone after logout", async () => {
    const id = await createSession(alice);
    await destroySession(id);
    expect(await getSession(id)).toBeNull();
  });

  it("returns null for an unknown session id", async () => {
    expect(await getSession("not-a-real-session")).toBeNull();
  });
});

describe("rate limiting", () => {
  it("allows the limit, then blocks with a retry time", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await hitRateLimit("test", 3, 60));

    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0]);
    expect(results[3].retryAfterSeconds).toBeGreaterThan(0);
    expect(results[3].retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("keeps separate counters per key", async () => {
    for (let i = 0; i < 3; i++) await hitRateLimit("a", 3, 60);
    expect((await hitRateLimit("b", 3, 60)).allowed).toBe(true);
  });

  it("never leaves a counter without an expiry", async () => {
    await hitRateLimit("ttl-check", 3, 60);
    expect(await redis.ttl("ratelimit:ttl-check")).toBeGreaterThan(0);
  });

  it("starts over after a reset", async () => {
    for (let i = 0; i < 4; i++) await hitRateLimit("r", 3, 60);
    await resetRateLimit("r");
    expect((await hitRateLimit("r", 3, 60)).allowed).toBe(true);
  });
});

describe("cache", () => {
  it("calls the loader once and serves later reads from Redis", async () => {
    const load = jest.fn().mockResolvedValue({ total: 5 });

    const first = await cached(CacheKeys.dashboard, 30, load);
    const second = await cached(CacheKeys.dashboard, 30, load);

    expect(first).toEqual({ total: 5 });
    expect(second).toEqual({ total: 5 });
    expect(load).toHaveBeenCalledTimes(1);
    expect(await redis.ttl(`cache:${CacheKeys.dashboard}`)).toBe(30);
  });

  it("reloads after invalidation", async () => {
    const load = jest.fn().mockResolvedValueOnce({ total: 5 }).mockResolvedValueOnce({ total: 6 });

    await cached(CacheKeys.dashboard, 30, load);
    await invalidate(CacheKeys.dashboard);

    expect(await cached(CacheKeys.dashboard, 30, load)).toEqual({ total: 6 });
    expect(load).toHaveBeenCalledTimes(2);
  });
});
