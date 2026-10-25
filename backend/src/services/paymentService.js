const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const db = require('../config/database');
const { invalidateEvent } = require('./cacheService');

/**
 * Mock Gateway Payment Engine
 * Approves / Rejects / Simulates Async Webhooks atomically.
 */
async function processPayment({
  reservationId,
  cardNumber = '4242424242424242',
  cardHolder = 'Demo Attendee',
  simulationMode = 'APPROVE', // 'APPROVE' | 'REJECT' | 'ASYNC_WEBHOOK'
  webhookOutcome = 'APPROVE'   // Outcome for async simulation
}) {
  const reservation = await db.queryOne('SELECT * FROM reservations WHERE id = ?', [reservationId]);

  if (!reservation) {
    const err = new Error('Reservation not found.');
    err.statusCode = 404;
    throw err;
  }

  if (reservation.status !== 'HELD') {
    const err = new Error(`Cannot checkout reservation with status '${reservation.status}'.`);
    err.statusCode = 400;
    throw err;
  }

  // Check 10-minute hold expiration
  const now = Date.now();
  const expiresAt = new Date(reservation.expires_at).getTime();
  if (now > expiresAt) {
    const err = new Error('Your 10-minute reservation hold has expired. The tickets have been released.');
    err.statusCode = 410; // Gone
    throw err;
  }

  // --- ASYNC WEBHOOK SIMULATION ---
  if (simulationMode === 'ASYNC_WEBHOOK') {
    const pendingTxnId = `txn_${uuidv4().substring(0, 12)}`;
    const gatewayRef = `gw_async_${uuidv4().substring(0, 8)}`;

    await db.run(
      `INSERT INTO transactions (
        id, reservation_id, amount, currency, payment_method, gateway_ref, status, created_at
      ) VALUES (?, ?, ?, 'USD', 'MOCK_CARD_ASYNC', ?, 'PENDING', ?)`,
      [pendingTxnId, reservationId, reservation.total_amount, gatewayRef, new Date().toISOString()]
    );

    // Schedule asynchronous webhook execution after 2.5 seconds
    setTimeout(async () => {
      try {
        console.log(`[Payment Gateway Webhook] Processing async webhook for reservation ${reservationId}...`);
        await handleAsyncWebhook({
          reservationId,
          transactionId: pendingTxnId,
          outcome: webhookOutcome,
          cardNumber,
          cardHolder
        });
      } catch (err) {
        console.error('[Payment Gateway Webhook Error]:', err);
      }
    }, 2500);

    return {
      status: 'PENDING',
      transactionId: pendingTxnId,
      gatewayRef,
      message: 'Payment initiated asynchronously. Webhook callback will confirm or reject within 3 seconds.',
      estimatedDelaySeconds: 3
    };
  }

  // --- REJECT SIMULATION ---
  if (simulationMode === 'REJECT') {
    const failedTxnId = `txn_${uuidv4().substring(0, 12)}`;
    const gatewayRef = `gw_declined_${uuidv4().substring(0, 8)}`;

    await db.transaction(async (tx) => {
      // Release held inventory back to available pool
      await tx.run(
        `UPDATE ticket_tiers
         SET available_quantity = available_quantity + ?,
             reserved_quantity = reserved_quantity - ?
         WHERE id = ?`,
        [reservation.quantity, reservation.quantity, reservation.ticket_tier_id]
      );

      // Cancel reservation
      await tx.run(
        `UPDATE reservations
         SET status = 'CANCELLED'
         WHERE id = ?`,
        [reservationId]
      );

      // Record failed transaction
      await tx.run(
        `INSERT INTO transactions (
          id, reservation_id, amount, currency, payment_method, gateway_ref, status, failure_reason, created_at
        ) VALUES (?, ?, ?, 'USD', 'MOCK_CARD', ?, 'FAILED', 'Card declined: Insufficient funds or invalid CVV (simulated)', ?)`,
        [failedTxnId, reservationId, reservation.total_amount, gatewayRef, new Date().toISOString()]
      );
    });

    await invalidateEvent(reservation.event_id);

    return {
      status: 'FAILED',
      transactionId: failedTxnId,
      gatewayRef,
      message: 'Payment declined by mock card issuer. Your held tickets have been released back to the event pool.'
    };
  }

  // --- APPROVE SIMULATION (SUCCESSFUL CHECKOUT) ---
  return await finalizeApprovedReservation({
    reservation,
    cardNumber,
    cardHolder,
    paymentMethod: 'MOCK_CREDIT_CARD'
  });
}

/**
 * Atomically finalizes an approved reservation:
 * 1. Checks validity & converts hold to confirmed
 * 2. Increments sold_quantity, decrements reserved_quantity
 * 3. Creates order
 * 4. Generates unique digital tickets with QR codes
 * 5. Records success transaction
 */
async function finalizeApprovedReservation({
  reservation,
  cardNumber,
  cardHolder,
  paymentMethod = 'MOCK_CREDIT_CARD',
  existingTxnId = null
}) {
  const result = await db.transaction(async (tx) => {
    // 1. Double check reservation is still HELD inside transaction
    const res = await tx.queryOne('SELECT * FROM reservations WHERE id = ?', [reservation.id]);
    if (!res || res.status !== 'HELD') {
      const err = new Error(`Reservation is already ${res ? res.status : 'missing'}.`);
      err.statusCode = 400;
      throw err;
    }

    // 2. Fetch event, tenant, and user info
    const event = await tx.queryOne('SELECT * FROM events WHERE id = ?', [res.event_id]);
    const tier = await tx.queryOne('SELECT * FROM ticket_tiers WHERE id = ?', [res.ticket_tier_id]);
    const user = await tx.queryOne('SELECT * FROM users WHERE id = ?', [res.user_id]);

    const now = new Date().toISOString();

    // 3. Update inventory
    await tx.run(
      `UPDATE ticket_tiers
       SET reserved_quantity = reserved_quantity - ?,
           sold_quantity = sold_quantity + ?
       WHERE id = ?`,
      [res.quantity, res.quantity, res.ticket_tier_id]
    );

    // 4. Update reservation status
    await tx.run(
      `UPDATE reservations
       SET status = 'CONFIRMED',
           confirmed_at = ?
       WHERE id = ?`,
      [now, res.id]
    );

    // 5. Create Order
    const orderId = `ord_${uuidv4().substring(0, 12)}`;
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    await tx.run(
      `INSERT INTO orders (
        id, order_number, reservation_id, event_id, tenant_id, user_id,
        ticket_tier_id, quantity, total_amount, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAID', ?)`,
      [
        orderId,
        orderNumber,
        res.id,
        res.event_id,
        event.tenant_id,
        res.user_id,
        res.ticket_tier_id,
        res.quantity,
        res.total_amount,
        now
      ]
    );

    // 6. Generate digital tickets with QR codes
    const tickets = [];
    const attendeeName = cardHolder || (user ? user.name : 'Attendee');
    const attendeeEmail = user ? user.email : 'guest@example.com';

    for (let i = 0; i < res.quantity; i++) {
      const ticketId = `tck_${uuidv4().substring(0, 12)}`;
      const ticketNumber = `TCK-${event.id.slice(-4).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;

      // Generate dynamic QR code data payload
      const qrPayload = JSON.stringify({
        ticketId,
        ticketNumber,
        eventId: event.id,
        eventTitle: event.title,
        tierName: tier.name,
        attendeeName,
        issuedAt: now,
        verificationUrl: `https://mock-verify.eventreserve.local/verify/${ticketId}`
      });

      const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
        errorCorrectionLevel: 'M',
        width: 256,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });

      await tx.run(
        `INSERT INTO tickets (
          id, order_id, ticket_number, event_id, ticket_tier_id,
          attendee_name, attendee_email, qr_code, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'VALID', ?)`,
        [
          ticketId,
          orderId,
          ticketNumber,
          event.id,
          res.ticket_tier_id,
          attendeeName,
          attendeeEmail,
          qrCodeDataUrl,
          now
        ]
      );

      tickets.push({
        id: ticketId,
        ticketNumber,
        attendeeName,
        attendeeEmail,
        tierName: tier.name,
        price: tier.price,
        qrCode: qrCodeDataUrl,
        status: 'VALID'
      });
    }

    // 7. Record / Update Transaction
    const txnId = existingTxnId || `txn_${uuidv4().substring(0, 12)}`;
    const gatewayRef = `gw_approved_${uuidv4().substring(0, 8)}`;
    const maskedCard = `****-****-****-${cardNumber.slice(-4)}`;

    if (existingTxnId) {
      await tx.run(
        `UPDATE transactions
         SET order_id = ?, status = 'SUCCESS', gateway_ref = ?, payment_method = ?
         WHERE id = ?`,
        [orderId, gatewayRef, `MOCK_CARD (${maskedCard})`, existingTxnId]
      );
    } else {
      await tx.run(
        `INSERT INTO transactions (
          id, order_id, reservation_id, amount, currency, payment_method, gateway_ref, status, created_at
        ) VALUES (?, ?, ?, ?, 'USD', ?, ?, 'SUCCESS', ?)`,
        [
          txnId,
          orderId,
          res.id,
          res.total_amount,
          `MOCK_CARD (${maskedCard})`,
          gatewayRef,
          now
        ]
      );
    }

    return {
      status: 'SUCCESS',
      order: {
        id: orderId,
        orderNumber,
        eventTitle: event.title,
        eventVenue: event.venue,
        eventDate: event.start_date,
        tierName: tier.name,
        quantity: res.quantity,
        totalAmount: res.total_amount,
        status: 'PAID',
        createdAt: now
      },
      tickets,
      transaction: {
        id: txnId,
        gatewayRef,
        amount: res.total_amount,
        status: 'SUCCESS',
        card: maskedCard
      }
    };
  });

  await invalidateEvent(reservation.event_id);
  return result;
}

/**
 * Handles simulated asynchronous webhook callbacks
 */
async function handleAsyncWebhook({ reservationId, transactionId, outcome, cardNumber, cardHolder }) {
  const reservation = await db.queryOne('SELECT * FROM reservations WHERE id = ?', [reservationId]);
  if (!reservation || reservation.status !== 'HELD') {
    console.warn(`[Async Webhook] Reservation ${reservationId} is no longer HELD. Ignoring.`);
    return;
  }

  if (outcome === 'APPROVE') {
    return await finalizeApprovedReservation({
      reservation,
      cardNumber,
      cardHolder,
      paymentMethod: 'MOCK_CARD_ASYNC',
      existingTxnId: transactionId
    });
  } else {
    // REJECT
    await db.transaction(async (tx) => {
      await tx.run(
        `UPDATE ticket_tiers
         SET available_quantity = available_quantity + ?,
             reserved_quantity = reserved_quantity - ?
         WHERE id = ?`,
        [reservation.quantity, reservation.quantity, reservation.ticket_tier_id]
      );

      await tx.run('UPDATE reservations SET status = "CANCELLED" WHERE id = ?', [reservationId]);

      await tx.run(
        `UPDATE transactions
         SET status = 'FAILED', failure_reason = 'Async webhook reported payment rejection.'
         WHERE id = ?`,
        [transactionId]
      );
    });

    await invalidateEvent(reservation.event_id);
  }
}

module.exports = {
  processPayment,
  handleAsyncWebhook
};
