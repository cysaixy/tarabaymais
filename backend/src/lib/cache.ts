import Redis from "ioredis";
import { createHash } from "crypto";

const cachingEnabled =
  Boolean(process.env.REDIS_URL) && process.env.CACHE_ENABLED !== "false";
const redisUrl = process.env.REDIS_URL;

let redisInstance: Redis | null = null;
let isRedisAvailable = false;
let hasLoggedRedisError = false;
let connectPromise: Promise<boolean> | undefined;

if (cachingEnabled) {
  redisInstance = new Redis(redisUrl!, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // Stop reconnect loop when Redis server is down
    lazyConnect: true,
    connectTimeout: 1000,
    commandTimeout: 1000,
    enableOfflineQueue: false,
  });

  redisInstance.on("error", (err) => {
    isRedisAvailable = false;
    if (!hasLoggedRedisError) {
      console.warn(
        "[Cache] Redis is not reachable, caching disabled. Falling back to DB:",
        err.message,
      );
      hasLoggedRedisError = true;
    }
  });
}

export const redis = redisInstance;

/** Connect lazily on first use */
async function ensureConnected(): Promise<boolean> {
  if (!redisInstance) return false;
  if (isRedisAvailable && redisInstance.status === "ready") return true;

  if (!connectPromise) {
    connectPromise = redisInstance
      .connect()
      .then(() => {
        isRedisAvailable = true;
        return true;
      })
      .catch(() => {
        isRedisAvailable = false;
        if (!hasLoggedRedisError) {
          console.warn("[Cache] Redis connection failed, continuing without cache.");
          hasLoggedRedisError = true;
        }
        return false;
      })
      .finally(() => {
        connectPromise = undefined;
      });
  }

  return connectPromise;
}

/** Hash a string to a short hex for cache keys */
export function hashKey(input: string, length = 16): string {
  return createHash("sha256").update(input).digest("hex").slice(0, length);
}

/** Cache-aside with optional lock to prevent stampede. Falls back to DB on Redis error (not fetchFn error). */
export async function getOrSet<T>(
  key: string,
  ttlSec: number,
  fetchFn: () => Promise<T>,
  options?: { lockMs?: number; jitterSec?: number },
): Promise<T> {
  if (!redis) return fetchFn();

  let fetchFnCalled = false;
  try {
    const ready = await ensureConnected();
    if (!ready || !redisInstance) {
      fetchFnCalled = true;
      return fetchFn();
    }

    const cached = await redisInstance.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }

    const lockMs = options?.lockMs ?? 100;
    const lockKey = `lock:${key}`;
    const gotLock = await redisInstance.set(lockKey, "1", "PX", lockMs, "NX");

    if (!gotLock) {
      await new Promise((r) => setTimeout(r, 20));
      const retry = await redisInstance.get(key);
      if (retry) return JSON.parse(retry) as T;
    }

    try {
      const fresh = await fetchFn();
      fetchFnCalled = true;
      const jitter = options?.jitterSec
        ? Math.floor(Math.random() * options.jitterSec)
        : 0;
      await redisInstance.set(
        key,
        JSON.stringify(fresh),
        "EX",
        ttlSec + jitter,
      );
      return fresh;
    } finally {
      if (gotLock) await redisInstance.del(lockKey);
    }
  } catch (err) {
    if (!fetchFnCalled) {
      return fetchFn();
    }
    throw err;
  }
}

/** Invalidate a single key */
export async function invalidate(key: string): Promise<void> {
  try {
    const ready = await ensureConnected();
    if (ready && redisInstance) {
      await redisInstance.del(key);
    }
  } catch {
    /* safely ignore */
  }
}

/** Invalidate all keys matching a prefix (SCAN + DEL in batches) */
export async function invalidatePrefix(prefix: string): Promise<void> {
  try {
    const ready = await ensureConnected();
    if (!ready || !redisInstance) return;
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redisInstance.scan(
        cursor,
        "MATCH",
        `${prefix}*`,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      if (keys.length) await redisInstance.del(...keys);
    } while (cursor !== "0");
  } catch {
    /* safely ignore */
  }
}

/** Versioned namespace for bulk invalidation (e.g., rag:chunks:v3:...) */
export function versionedKey(
  namespace: string,
  version: string | number,
  ...parts: string[]
): string {
  return `${namespace}:v${version}:${parts.join(":")}`;
}

/** Close connection (for graceful shutdown) */
export async function closeCache(): Promise<void> {
  if (!redisInstance) return;

  // Disconnect immediately so shutdown never waits for an unavailable Redis server.
  redisInstance.disconnect();
  isRedisAvailable = false;
}
