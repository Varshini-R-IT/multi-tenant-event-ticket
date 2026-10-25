const cron = require('node-cron');
const db = require('../config/database');
const { invalidateEvent } = require('./cacheService');

let cronTask = null;

/**
 * Scans for temporary holds where status = 'HELD' and expires_at < NOW()
 * Atomically releases tickets back to available pool and marks reservation EXPIRED
 */
async function cleanupExpiredHolds() {
  const now = new Date().toISOString();

  // Find all expired reservations
  const expiredHolds = await db.query(
    `SELECT id, ticket_tier_id, event_id, quantity, user_id, expires_at
     FROM reservations
     WHERE status = 'HELD' AND expires_at < ?`,
    [now]
  );

  if (!expiredHolds || expiredHolds.length === 0) {
    return { releasedCount: 0, items: [] };
  }

  console.log(`[Worker] Detected ${expiredHolds.length} expired reservation hold(s). Releasing inventory...`);

  const affectedEvents = new Set();

  await db.transaction(async (tx) => {
    for (const hold of expiredHolds) {
      // 1. Return held tickets to available pool
      await tx.run(
        `UPDATE ticket_tiers
         SET available_quantity = available_quantity + ?,
             reserved_quantity = reserved_quantity - ?
         WHERE id = ?`,
        [hold.quantity, hold.quantity, hold.ticket_tier_id]
      );

      // 2. Mark reservation EXPIRED
      await tx.run(
        `UPDATE reservations
         SET status = 'EXPIRED'
         WHERE id = ?`,
        [hold.id]
      );

      affectedEvents.add(hold.event_id);
    }
  });

  // 3. Invalidate Redis cache for all affected events
  for (const eventId of affectedEvents) {
    await invalidateEvent(eventId);
  }

  console.log(`[Worker] Successfully released ${expiredHolds.length} expired hold(s) back to inventory.`);

  return {
    releasedCount: expiredHolds.length,
    releasedReservations: expiredHolds.map((h) => ({ id: h.id, tierId: h.ticket_tier_id, quantity: holdQuantity(h) }))
  };
}

function holdQuantity(h) {
  return parseInt(h.quantity, 10);
}

/**
 * Starts background cron task running every 10 seconds
 */
function startWorker() {
  console.log('[Worker] Starting background hold-expiration worker (runs every 10 seconds)...');

  // Runs every 10 seconds: */10 * * * * *
  cronTask = cron.schedule('*/10 * * * * *', async () => {
    try {
      await cleanupExpiredHolds();
    } catch (err) {
      console.error('[Worker] Error during hold expiration cleanup:', err);
    }
  });

  return cronTask;
}

function stopWorker() {
  if (cronTask) {
    cronTask.stop();
    console.log('[Worker] Background hold-expiration worker stopped.');
  }
}

module.exports = {
  cleanupExpiredHolds,
  startWorker,
  stopWorker
};
