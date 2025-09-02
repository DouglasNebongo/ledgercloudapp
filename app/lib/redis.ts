
// libs/redis.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Redis as UpstashRedis } from '@upstash/redis';
let redis: UpstashRedis | undefined;


type MaybeString = string | null | undefined;
type SetOptions = { EX?: number };

/**
 * Cross-runtime redis adapter.
 * - Node runtime: lazy-loads node-redis on first use.
 * - Edge runtime: uses Upstash (if configured).
 *
 * Exports default `redisClient` object so existing imports remain unchanged.
 */

// --- Upstash init (safe at module load) ---
let upstash: UpstashRedis | undefined;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    upstash = new UpstashRedis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    console.log('Upstash Redis client initialized for queue operations.');
  } else {
    console.debug('Upstash env vars not set; Upstash client not initialized.');
  }
} catch (err) {
  console.error('Failed to initialize Upstash client at runtime:', err);
}

// --- runtime detection ---
function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && !!(process.versions && process.versions.node);
}

// --- lazy node-redis client ---
let nodeClient: any | undefined;
async function initNodeRedisClient() {
  if (!isNodeRuntime()) {
    throw new Error('Node redis client can only be created in a Node (server) runtime.');
  }
  if (nodeClient) return nodeClient;

  try {
    const { createClient } = await import('redis');
    nodeClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        tls: true,
      },
    });

    nodeClient.on('error', (err: unknown) => {
      console.error('Redis Client Error :', err);
    });

    await nodeClient.connect();
    console.log('Standard Redis client connected.');
    return nodeClient;
  } catch (err) {
    console.error('Failed to initialize standard Redis client at runtime:', err);
    throw err;
  }
}

export async function getNodeRedisClient() {
  return await initNodeRedisClient();
}

// --- adapter methods (coerce values as needed) ---
async function nodeOrUpstashGet(key: string): Promise<MaybeString> {
  if (isNodeRuntime()) {
    const c = await initNodeRedisClient();
    return await c.get(key);
  }
  if (upstash) {
    return await upstash.get(key);
  }
  return null;
}

async function nodeOrUpstashSet(key: string, value: string | number, opts?: SetOptions) {
  const strValue = typeof value === 'number' ? String(value) : value;
  if (isNodeRuntime()) {
    const c = await initNodeRedisClient();
    if (opts?.EX) {
      // node-redis expects options differently depending on version; using { EX: seconds }
      return await c.set(key, strValue, { EX: opts.EX });
    }
    return await c.set(key, strValue);
  }
  if (upstash) {
    if (opts?.EX) {
      return await upstash.set(key, strValue, { ex: opts.EX });
    }
    return await upstash.set(key, strValue);
  }
  throw new Error('No Redis client available for set().');
}

async function nodeOrUpstashLpush(key: string, value: string | number): Promise<number | null> {
  const strValue = typeof value === 'number' ? String(value) : value;
  if (isNodeRuntime()) {
    const c = await initNodeRedisClient();
    // node-redis v4 has lPush
    return await c.lPush(key, strValue);
  }
  if (upstash) {
    return await upstash.lpush(key, strValue);
  }
  throw new Error('No Redis client available for lpush().');
}

async function nodeOrUpstashRpop(key: string): Promise<MaybeString> {
  if (isNodeRuntime()) {
    const c = await initNodeRedisClient();
    return await c.rPop(key);
  }
  if (upstash) {
    return await upstash.rpop(key);
  }
  return null;
}

async function nodeOrUpstashDel(key: string): Promise<number | null> {
  if (isNodeRuntime()) {
    const c = await initNodeRedisClient();
    return await c.del(key);
  }
  if (upstash) {
    return await upstash.del(key);
  }
  return null;
}

async function nodeOrUpstashExists(key: string): Promise<number> {
  if (isNodeRuntime()) {
    const c = await initNodeRedisClient();
    return await c.exists(key);
  }
  if (upstash) {
    const res = await upstash.exists(key);
    return typeof res === 'number' ? res : Number(res);
  }
  return 0;
}

async function nodeOrUpstashExpire(key: string, seconds: number): Promise<number | null> {
  if (isNodeRuntime()) {
    const c = await initNodeRedisClient();
    return await c.expire(key, seconds);
  }
  if (upstash) {
    return await upstash.expire(key, seconds);
  }
  return null;
}

// --- exported "redisClient" adapter object ---
const redisClient = {
  get: (key: string) => nodeOrUpstashGet(key),
  // Accept number | string for set to match callers in your app
  set: (key: string, value: string | number, opts?: SetOptions) => nodeOrUpstashSet(key, value, opts),
  lpush: (key: string, value: string | number) => nodeOrUpstashLpush(key, value),
  rpop: (key: string) => nodeOrUpstashRpop(key),
  del: (key: string) => nodeOrUpstashDel(key),
  exists: (key: string) => nodeOrUpstashExists(key),
  expire: (key: string, seconds: number) => nodeOrUpstashExpire(key, seconds),

  // helpers for advanced usage
  getNodeClient: async () => {
    if (!isNodeRuntime()) throw new Error('getNodeClient() is only available in Node runtime.');
    return initNodeRedisClient();
  },
  getUpstashClient: () => upstash,
  _isNode: isNodeRuntime(),
};

export default redisClient;









  try {
    redis = new UpstashRedis({ 
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    console.log("Upstash Redis client initialized for queue operations.");
  } catch (error) {
    console.error("Failed to initialize Upstash Redis client for queue operations at runtime:", error);
  
  }



export async function addToQueue(email: string) {
  
  if (!redis) {
    console.error("Redis client not initialized. Cannot add email to queue:", email);
 
    return; 
  }

  try {
    await redis.lpush('email-queue', email);
    console.log(`Added ${email} to email-queue.`); 
  } catch (error) {
     console.error(`Failed to add ${email} to email-queue:`, error);
    
   }

}