const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

/**
 * In-Memory Redis Fallback Store
 * Provides Redis SET, GET, DEL, KEYS, TTL expiration and atomic distributed locking
 */
class MemoryRedisStore {
  constructor() {
    this.store = new Map();
    this.expirations = new Map();
    this.locks = new Map();
  }

  async get(key) {
    this._checkExpired(key);
    const item = this.store.get(key);
    return item !== undefined ? item : null;
  }

  async set(key, value, mode, ttl) {
    this.store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    if (mode && mode.toUpperCase() === 'EX' && ttl) {
      const expiresAt = Date.now() + parseInt(ttl, 10) * 1000;
      this.expirations.set(key, expiresAt);
    } else {
      this.expirations.delete(key);
    }
    return 'OK';
  }

  async del(key) {
    this.expirations.delete(key);
    return this.store.delete(key) ? 1 : 0;
  }

  async keys(pattern) {
    this._cleanupAll();
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const matched = [];
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        matched.push(key);
      }
    }
    return matched;
  }

  async flushall() {
    this.store.clear();
    this.expirations.clear();
    this.locks.clear();
    return 'OK';
  }

  _checkExpired(key) {
    if (this.expirations.has(key)) {
      if (Date.now() > this.expirations.get(key)) {
        this.store.delete(key);
        this.expirations.delete(key);
      }
    }
  }

  _cleanupAll() {
    const now = Date.now();
    for (const [key, exp] of this.expirations.entries()) {
      if (now > exp) {
        this.store.delete(key);
        this.expirations.delete(key);
      }
    }
  }
}

let redisClient = null;
let isRealRedis = false;
const memoryRedis = new MemoryRedisStore();

async function initRedis() {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      console.log(`[Redis] Connecting to external Redis at ${redisUrl.split('@')[1] || redisUrl}...`);
      const client = new Redis(redisUrl, {
        retryStrategy(times) {
          if (times > 3) {
            console.warn('[Redis] Max retries reached. Falling back to MemoryRedis.');
            return null;
          }
          return Math.min(times * 100, 2000);
        },
        maxRetriesPerRequest: 2
      });

      await new Promise((resolve, reject) => {
        client.on('ready', () => {
          console.log('[Redis] Connected to external Redis instance successfully.');
          redisClient = client;
          isRealRedis = true;
          resolve();
        });
        client.on('error', (err) => {
          console.warn(`[Redis] Connection warning: ${err.message}. Using high-performance MemoryRedis fallback.`);
          client.disconnect();
          resolve();
        });
      });
    } catch (err) {
      console.warn(`[Redis] Failed to connect: ${err.message}. Using MemoryRedis fallback.`);
    }
  }

  if (!isRealRedis) {
    console.log('[Redis] Running high-performance in-memory Redis cache & distributed lock engine.');
    redisClient = memoryRedis;
  }

  return redisClient;
}

/**
 * Distributed Lock acquisition for serializing concurrent ticket reservation attempts
 * Uses SET resource lockToken NX PX ttlMs in Redis, or atomic map in MemoryRedis
 */
async function acquireLock(resourceKey, ttlMs = 5000) {
  const lockToken = uuidv4();
  const lockKey = `lock:${resourceKey}`;

  if (isRealRedis) {
    const result = await redisClient.set(lockKey, lockToken, 'PX', ttlMs, 'NX');
    if (result === 'OK') {
      return { acquired: true, token: lockToken, key: lockKey };
    }
    return { acquired: false };
  }

  // Memory lock with atomic check-and-set
  const now = Date.now();
  const existing = memoryRedis.locks.get(lockKey);
  if (!existing || existing.expiresAt < now) {
    memoryRedis.locks.set(lockKey, { token: lockToken, expiresAt: now + ttlMs });
    return { acquired: true, token: lockToken, key: lockKey };
  }

  return { acquired: false };
}

/**
 * Release distributed lock safely
 */
async function releaseLock(resourceKey, lockToken) {
  const lockKey = `lock:${resourceKey}`;

  if (isRealRedis) {
    // Lua script to atomically release only if token matches
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    return await redisClient.eval(script, 1, lockKey, lockToken);
  }

  const existing = memoryRedis.locks.get(lockKey);
  if (existing && existing.token === lockToken) {
    memoryRedis.locks.delete(lockKey);
    return 1;
  }
  return 0;
}

module.exports = {
  initRedis,
  getRedis: () => redisClient || memoryRedis,
  isRealRedis: () => isRealRedis,
  acquireLock,
  releaseLock
};
