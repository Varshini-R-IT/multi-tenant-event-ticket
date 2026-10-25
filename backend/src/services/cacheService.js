const { getRedis } = require('../config/redis');

const TTL = {
  ACTIVE_EVENTS: 60, // 60 seconds
  EVENT_DETAIL: 60   // 60 seconds
};

async function getCached(key) {
  try {
    const redis = getRedis();
    const data = await redis.get(key);
    if (data) {
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn(`[Cache] Error reading key "${key}":`, err.message);
  }
  return null;
}

async function setCached(key, value, ttlSeconds = 60) {
  try {
    const redis = getRedis();
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    console.warn(`[Cache] Error setting key "${key}":`, err.message);
  }
}

async function invalidateEvent(eventId) {
  try {
    const redis = getRedis();
    await redis.del(`event:${eventId}`);
    await redis.del('events:active');
    console.log(`[Cache] Invalidated cache for event:${eventId} and events:active`);
  } catch (err) {
    console.warn(`[Cache] Invalidation error for event ${eventId}:`, err.message);
  }
}

async function invalidateAllEvents() {
  try {
    const redis = getRedis();
    const keys = await redis.keys('event:*');
    for (const k of keys) {
      await redis.del(k);
    }
    await redis.del('events:active');
    console.log('[Cache] Invalidated all events caches.');
  } catch (err) {
    console.warn('[Cache] Invalidation error:', err.message);
  }
}

module.exports = {
  TTL,
  getCached,
  setCached,
  invalidateEvent,
  invalidateAllEvents
};
