const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { acquireLock, releaseLock } = require('../config/redis');
const { invalidateEvent } = require('./cacheService');

/**
 * Creates a 10-minute temporary reservation hold with atomic concurrency controls.
 * Uses distributed Redis locks + ACID database transactions to prevent double-booking.
 */
async function createHold({ tierId, userId, quantity = 1 }) {
  const qty = parseInt(quantity, 10);
  if (!qty || qty <= 0) {
    const error = new Error('Reservation quantity must be at least 1.');
    error.statusCode = 400;
    throw error;
  }

  // Step 1: Acquire distributed lock on the ticket tier (retry up to 3 times with backoff)
  let lock = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    lock = await acquireLock(`tier:${tierId}`, 6000);
    if (lock.acquired) break;
    await new Promise((res) => setTimeout(res, 40 + Math.random() * 30));
  }

  if (!lock || !lock.acquired) {
    const error = new Error('High demand on this ticket tier. Please retry in a moment.');
    error.statusCode = 429;
    throw error;
  }

  try {
    // Step 2: Atomic Database Transaction
    const reservation = await db.transaction(async (tx) => {
      // Row-level lock or serialized check
      const tierSelectSql = db.isPostgres()
        ? 'SELECT * FROM ticket_tiers WHERE id = ? FOR UPDATE'
        : 'SELECT * FROM ticket_tiers WHERE id = ?';
      const tier = await tx.queryOne(tierSelectSql, [tierId]);

      if (!tier) {
        const err = new Error('Ticket tier not found.');
        err.statusCode = 404;
        throw err;
      }

      // Check max tickets per order
      if (qty > tier.max_per_order) {
        const err = new Error(`Cannot reserve more than ${tier.max_per_order} tickets per order.`);
        err.statusCode = 400;
        throw err;
      }

      // Check event sales cutoff date
      const event = await tx.queryOne('SELECT * FROM events WHERE id = ?', [tier.event_id]);
      if (!event) {
        const err = new Error('Associated event not found.');
        err.statusCode = 404;
        throw err;
      }

      if (event.status !== 'PUBLISHED') {
        const err = new Error('This event is currently not open for ticket sales.');
        err.statusCode = 400;
        throw err;
      }

      if (event.sales_cutoff_date && new Date(event.sales_cutoff_date).getTime() < Date.now()) {
        const err = new Error('Ticket sales cut-off date has passed for this event.');
        err.statusCode = 400;
        throw err;
      }

      // CRITICAL CONCURRENCY CHECK: ensure available inventory is strictly sufficient
      const available = parseInt(tier.available_quantity, 10);
      if (available < qty) {
        const err = new Error(
          available === 0
            ? 'Sold out! All tickets for this tier are currently booked or on hold.'
            : `Insufficient tickets remaining. Only ${available} available.`
        );
        err.statusCode = 409; // Conflict
        err.available = available;
        throw err;
      }

      // Decrement available, increment reserved
      await tx.run(
        `UPDATE ticket_tiers
         SET available_quantity = available_quantity - ?,
             reserved_quantity = reserved_quantity + ?
         WHERE id = ?`,
        [qty, qty, tierId]
      );

      // 10-minute hold window
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes
      const reservationId = `res_${uuidv4().substring(0, 12)}`;
      const holdToken = `ht_${uuidv4()}`;
      const unitPrice = parseFloat(tier.price);
      const totalAmount = parseFloat((unitPrice * qty).toFixed(2));

      await tx.run(
        `INSERT INTO reservations (
          id, ticket_tier_id, event_id, user_id, quantity,
          unit_price, total_amount, status, hold_token,
          created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'HELD', ?, ?, ?)`,
        [
          reservationId,
          tierId,
          tier.event_id,
          userId,
          qty,
          unitPrice,
          totalAmount,
          holdToken,
          now.toISOString(),
          expiresAt.toISOString()
        ]
      );

      return {
        id: reservationId,
        ticketTierId: tierId,
        tierName: tier.name,
        eventId: tier.event_id,
        eventTitle: event.title,
        userId,
        quantity: qty,
        unitPrice,
        totalAmount,
        status: 'HELD',
        holdToken,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        secondsRemaining: 600
      };
    });

    // Step 3: Invalidate Cache
    await invalidateEvent(reservation.eventId);

    return reservation;
  } finally {
    // Step 4: Always release distributed lock
    await releaseLock(`tier:${tierId}`, lock.token);
  }
}

/**
 * Fetch reservation details and compute real-time remaining countdown seconds.
 */
async function getReservationById(reservationId) {
  const res = await db.queryOne(
    `SELECT r.*, t.name as tier_name, e.title as event_title, e.banner_url as event_banner
     FROM reservations r
     JOIN ticket_tiers t ON r.ticket_tier_id = t.id
     JOIN events e ON r.event_id = e.id
     WHERE r.id = ?`,
    [reservationId]
  );

  if (!res) return null;

  const now = Date.now();
  const expiresAt = new Date(res.expires_at).getTime();
  const secondsRemaining = Math.max(0, Math.floor((expiresAt - now) / 1000));

  // If status is still HELD but expired, return secondsRemaining = 0
  return {
    ...res,
    secondsRemaining,
    isExpired: res.status === 'EXPIRED' || (res.status === 'HELD' && secondsRemaining <= 0)
  };
}

/**
 * Early release of a temporary hold by the user or admin
 */
async function releaseHold(reservationId, userId = null) {
  const res = await db.queryOne('SELECT * FROM reservations WHERE id = ?', [reservationId]);
  if (!res) {
    const err = new Error('Reservation not found.');
    err.statusCode = 404;
    throw err;
  }

  if (userId && res.user_id !== userId) {
    const err = new Error('Unauthorized to release this reservation.');
    err.statusCode = 403;
    throw err;
  }

  if (res.status !== 'HELD') {
    return { success: false, message: `Reservation is already in '${res.status}' status.` };
  }

  await db.transaction(async (tx) => {
    // Return tickets back to available pool
    await tx.run(
      `UPDATE ticket_tiers
       SET available_quantity = available_quantity + ?,
           reserved_quantity = reserved_quantity - ?
       WHERE id = ?`,
      [res.quantity, res.quantity, res.ticket_tier_id]
    );

    // Mark reservation cancelled
    await tx.run(
      `UPDATE reservations
       SET status = 'CANCELLED'
       WHERE id = ?`,
      [reservationId]
    );
  });

  await invalidateEvent(res.event_id);

  return { success: true, message: 'Reservation hold released successfully.' };
}

module.exports = {
  createHold,
  getReservationById,
  releaseHold
};
