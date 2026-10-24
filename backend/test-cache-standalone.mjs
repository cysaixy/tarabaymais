// Run with: npm run test:cache
// Optional: set REDIS_URL to point at a non-default Redis instance.
import 'dotenv/config';
import { randomUUID } from 'node:crypto';

process.env.CACHE_ENABLED ??= 'true';
process.env.REDIS_URL ??= 'redis://localhost:6379';

if (process.env.CACHE_ENABLED === 'false') {
  throw new Error('CACHE_ENABLED must not be "false" when testing Redis caching.');
}

const { getOrSet, invalidate, closeCache } = await import('./dist/lib/cache.js');
const key = `test:cache:${randomUUID()}`;

async function main() {
  let callCount = 0;
  const fetchFn = async () => {
    callCount++;
    const value = { data: 'hello', requestNumber: callCount };
    console.log(`  [Source] fetchFn called (count: ${callCount})`);
    return value;
  };

  try {
    console.log('Redis cache test started.');

    console.log('\n1. First call (expected: source function):');
    const first = await getOrSet(key, 60, fetchFn);
    console.log('   Result:', first);

    console.log('\n2. Second call (expected: Redis cache):');
    const second = await getOrSet(key, 60, fetchFn);
    console.log('   Result:', second);

    if (callCount !== 1 || first.requestNumber !== second.requestNumber) {
      throw new Error(
        'Redis did not return a cached result. Confirm Redis is running and REDIS_URL points to it.'
      );
    }

    console.log('\n3. After invalidation (expected: source function):');
    await invalidate(key);
    const third = await getOrSet(key, 60, fetchFn);
    console.log('   Result:', third);

    if (callCount !== 2 || first.requestNumber === third.requestNumber) {
      throw new Error(
        `Redis cache check failed: fetchFn ran ${callCount} times (expected 2). ` +
        'Invalidation did not clear the cached value.'
      );
    }

    console.log('\nPASS: Redis returned the cached second result and invalidation cleared it.');
  } finally {
    await invalidate(key).catch(() => undefined);
    await closeCache();
  }
}

main().catch((error) => {
  console.error('\nFAIL:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
