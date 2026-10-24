import Redis from 'ioredis';
import { createHash } from 'crypto';

const cachingEnabled = Boolean(process.env.REDIS_URL) && process.env.CACHE_ENABLED !== 'false';
const redisUrl = process.env.REDIS_URL;

const redis = cachingEnabled ? new Redis(redisUrl!, {
  maxRetriesPerRequest: 1,
  retryStrategy: (times) => (times > 2 ? null : 100),
  lazyConnect: true,
  // Fail fast instead of queueing commands while Redis is unavailable.
  connectTimeout: 1500,
  commandTimeout: 1500,
  enableOfflineQueue: false,
}) : null;

if (redis) {
  redis.on('error', (err) => {
    console.error('[Cache] Redis connection error:', err.message);
  });
}

/** Connect lazily on first use */
let connected = false;
let connectPromise: Promise<void> | undefined;
async function ensureConnected() {
  if (!redis || connected) return;

  if (!connectPromise) {
    connectPromise = redis.connect().then(() => {
      connected = true;
    }).finally(() => {
      connectPromise = undefined;
    });
  }

  await connectPromise;
}

/** Hash a string to a short hex for cache keys */
export function hashKey(input: string, length = 16): string {
  return createHash('sha256').update(input).digest('hex').slice(0, length);
}

/** Cache-aside with optional lock to prevent stampede. Falls back to DB on Redis error (not fetchFn error). */
export async function getOrSet<T>(
  key: string,
  ttlSec: number,
  fetchFn: () => Promise<T>,
  options?: { lockMs?: number; jitterSec?: number }
): Promise<T> {
  if (!redis) return fetchFn();

  let fetchFnCalled = false;
  try {
    await ensureConnected();

    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }

    const lockMs = options?.lockMs ?? 100;
    const lockKey = `lock:${key}`;
    const gotLock = await redis.set(lockKey, '1', 'PX', lockMs, 'NX');

    if (!gotLock) {
      await new Promise((r) => setTimeout(r, 20));
      const retry = await redis.get(key);
      if (retry) return JSON.parse(retry) as T;
    }

    try {
      const fresh = await fetchFn();
      fetchFnCalled = true;
      const jitter = options?.jitterSec ? Math.floor(Math.random() * options.jitterSec) : 0;
      await redis.set(key, JSON.stringify(fresh), 'EX', ttlSec + jitter);
      return fresh;
    } finally {
      if (gotLock) await redis.del(lockKey);
    }
  } catch (err) {
    if (!fetchFnCalled) {
      console.warn('[Cache] Redis error, falling back to DB:', err instanceof Error ? err.message : String(err));
      return fetchFn();
    }
    throw err;
  }
}

/** Invalidate a single key */
export async function invalidate(key: string): Promise<void> {
  if (!redis) return;

  await ensureConnected();
  await redis.del(key);
}

/** Invalidate all keys matching a prefix (SCAN + DEL in batches) */
export async function invalidatePrefix(prefix: string): Promise<void> {
  if (!redis) return;

  await ensureConnected();
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length) await redis.del(...keys);
  } while (cursor !== '0');
}

/** Versioned namespace for bulk invalidation (e.g., rag:chunks:v3:...) */
export function versionedKey(namespace: string, version: string | number, ...parts: string[]): string {
  return `${namespace}:v${version}:${parts.join(':')}`;
}

/** Close connection (for graceful shutdown) */
export async function closeCache(): Promise<void> {
  if (!redis) return;

  // disconnect() is immediate, unlike quit(), so shutdown cannot wait on Redis.
  redis.disconnect();
  connected = false;
}
