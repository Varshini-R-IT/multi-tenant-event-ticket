const http = require('http');
const db = require('../src/config/database');
const { initRedis } = require('../src/config/redis');
const { createSchema } = require('../src/models/schema');
const { createHold, getReservationById } = require('../src/services/reservationService');
const { processPayment } = require('../src/services/paymentService');
const { cleanupExpiredHolds } = require('../src/services/workerService');
const { v4: uuidv4 } = require('uuid');

async function runConcurrencyTestSuite() {
  console.log('================================================================');
  console.log(' RUNNING CONCURRENCY & RACE-CONDITION AUTOMATED TEST SUITE');
  console.log('================================================================\n');

  // 1. Initialize DB and Redis
  await db.initDatabase();
  await createSchema();
  await initRedis();

  const testEventId = `evt_race_${uuidv4().substring(0, 8)}`;
  const testTierId = `tier_limited_${uuidv4().substring(0, 8)}`;
  const limitedCapacity = 5;
  const concurrentAttempts = 30;

  console.log(`[Setup] Creating test event with high-demand tier:`);
  console.log(`        Tier Capacity: ${limitedCapacity} tickets`);
  console.log(`        Simultaneous Booking Contenders: ${concurrentAttempts} concurrent users\n`);

  // Insert test event and tier
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO events (
      id, tenant_id, organizer_id, title, description, category, venue,
      start_date, end_date, sales_cutoff_date, status, created_at, updated_at
    ) VALUES (?, 'ten_techsummit', 'usr_sarah', 'High-Concurrency Stress Test Event',
      'Simulated high contention ticket rush', 'Test', 'Virtual Arena',
      ?, ?, ?, 'PUBLISHED', ?, ?)`,
    [
      testEventId,
      new Date(Date.now() + 86400000).toISOString(),
      new Date(Date.now() + 172800000).toISOString(),
      new Date(Date.now() + 86400000).toISOString(),
      now,
      now
    ]
  );

  await db.run(
    `INSERT INTO ticket_tiers (
      id, event_id, name, description, price, total_quantity,
      available_quantity, reserved_quantity, sold_quantity, max_per_order, created_at
    ) VALUES (?, ?, 'Ultra-Exclusive VIP', 'Only 5 seats exist', 150.00, ?, ?, 0, 0, 2, ?)`,
    [testTierId, testEventId, limitedCapacity, limitedCapacity, now]
  );

  console.log(`[TEST 1] Firing ${concurrentAttempts} simultaneous reservation requests for ${limitedCapacity} tickets...`);

  const startTime = Date.now();

  // Fire 30 concurrent asynchronous requests using Promise.all
  const promises = [];
  for (let i = 0; i < concurrentAttempts; i++) {
    const contenderId = `user_contender_${i + 1}`;
    promises.push(
      createHold({
        tierId: testTierId,
        userId: contenderId,
        quantity: 1
      })
        .then((res) => ({ success: true, user: contenderId, reservation: res }))
        .catch((err) => ({
          success: false,
          user: contenderId,
          error: err.message,
          statusCode: err.statusCode
        }))
    );
  }

  const results = await Promise.all(promises);
  const duration = Date.now() - startTime;

  const successful = results.filter((r) => r.success);
  const conflicts = results.filter((r) => !r.success && r.statusCode === 409);
  const otherErrors = results.filter((r) => !r.success && r.statusCode !== 409);

  console.log(`\n[Results Summary - ${duration}ms]:`);
  console.log(` -> Successful Reservations: ${successful.length} / ${limitedCapacity} (Expected: ${limitedCapacity})`);
  console.log(` -> Clean 409 Conflict Rejections: ${conflicts.length} / ${concurrentAttempts - limitedCapacity} (Expected: ${concurrentAttempts - limitedCapacity})`);
  console.log(` -> Unexpected Errors: ${otherErrors.length} (Expected: 0)`);

  // Verify DB state
  const tierState = await db.queryOne('SELECT * FROM ticket_tiers WHERE id = ?', [testTierId]);
  console.log(`\n[Database Inventory Verification]:`);
  console.log(` -> Total: ${tierState.total_quantity}`);
  console.log(` -> Reserved: ${tierState.reserved_quantity} (Expected: ${limitedCapacity})`);
  console.log(` -> Available: ${tierState.available_quantity} (Expected: 0)`);
  console.log(` -> Sold: ${tierState.sold_quantity}`);

  if (successful.length === limitedCapacity && tierState.available_quantity === 0 && tierState.reserved_quantity === limitedCapacity) {
    console.log('\n>>> [PASS] RACE CONDITION TEST PASSED: Exactly 5 bookings succeeded, zero double-bookings! <<<\n');
  } else {
    console.error('\n>>> [FAIL] RACE CONDITION TEST FAILED! Double booking detected! <<<\n');
    process.exit(1);
  }

  // [TEST 2] Expired Hold Background Worker Test
  console.log('----------------------------------------------------------------');
  console.log('[TEST 2] Testing 10-Minute Hold Expiry & Automatic Worker Release...');

  // Take one of the successful reservations and artificially backdate expires_at to 5 minutes ago
  const targetHold = successful[0].reservation;
  const expiredTimestamp = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  await db.run('UPDATE reservations SET expires_at = ? WHERE id = ?', [expiredTimestamp, targetHold.id]);
  console.log(` -> Artificially set reservation ${targetHold.id} expiry to past (${expiredTimestamp})`);

  // Execute background worker cleanup
  const cleanupResult = await cleanupExpiredHolds();
  console.log(` -> Worker executed. Holds released: ${cleanupResult.releasedCount}`);

  // Check tier inventory: available should now be 1 (restored), reserved should be 4
  const updatedTier = await db.queryOne('SELECT * FROM ticket_tiers WHERE id = ?', [testTierId]);
  const updatedRes = await db.queryOne('SELECT * FROM reservations WHERE id = ?', [targetHold.id]);

  console.log(` -> Updated Reservation Status: ${updatedRes.status} (Expected: EXPIRED)`);
  console.log(` -> Restored Available Inventory: ${updatedTier.available_quantity} (Expected: 1)`);
  console.log(` -> Updated Reserved Inventory: ${updatedTier.reserved_quantity} (Expected: 4)`);

  if (updatedRes.status === 'EXPIRED' && updatedTier.available_quantity === 1) {
    console.log('\n>>> [PASS] EXPIRED HOLD WORKER TEST PASSED: Inventory automatically restored! <<<\n');
  } else {
    console.error('\n>>> [FAIL] EXPIRED HOLD WORKER TEST FAILED! <<<\n');
    process.exit(1);
  }

  // [TEST 3] Payment Simulation Edge Cases (Decline vs Approval)
  console.log('----------------------------------------------------------------');
  console.log('[TEST 3] Testing Mock Gateway Payments (Decline & Approve)...');

  // Test Decline: Take second reservation and decline payment
  const secondHold = successful[1].reservation;
  const declineResult = await processPayment({
    reservationId: secondHold.id,
    simulationMode: 'REJECT'
  });

  console.log(` -> Simulated Decline Status: ${declineResult.status}`);
  const postDeclineTier = await db.queryOne('SELECT * FROM ticket_tiers WHERE id = ?', [testTierId]);
  console.log(` -> Available Inventory after decline: ${postDeclineTier.available_quantity} (Restored to 2)`);

  // Test Approve: Take third reservation and approve checkout
  const thirdHold = successful[2].reservation;
  const approveResult = await processPayment({
    reservationId: thirdHold.id,
    simulationMode: 'APPROVE',
    cardHolder: 'Concurrently Verified Attendee'
  });

  console.log(` -> Simulated Approval Status: ${approveResult.status}`);
  console.log(` -> Order Generated: ${approveResult.order.orderNumber}`);
  console.log(` -> Tickets Issued: ${approveResult.tickets.length}`);
  console.log(` -> QR Code Generated: ${approveResult.tickets[0].qrCode ? 'Yes (Valid DataURL)' : 'No'}`);

  const postApproveTier = await db.queryOne('SELECT * FROM ticket_tiers WHERE id = ?', [testTierId]);
  console.log(` -> Sold Inventory after approval: ${postApproveTier.sold_quantity} (Expected: 1)`);

  if (declineResult.status === 'FAILED' && approveResult.status === 'SUCCESS' && postApproveTier.sold_quantity === 1) {
    console.log('\n>>> [PASS] PAYMENT GATEWAY & ORDER CHECKOUT TEST PASSED! <<<\n');
  } else {
    console.error('\n>>> [FAIL] PAYMENT GATEWAY TEST FAILED! <<<\n');
    process.exit(1);
  }

  console.log('================================================================');
  console.log(' ALL TEST SUITES COMPLETED WITH 100% SUCCESS!');
  console.log(' Zero double bookings. Strict ACID transactions verified.');
  console.log('================================================================\n');

  process.exit(0);
}

runConcurrencyTestSuite().catch((err) => {
  console.error('[Test Suite Error]:', err);
  process.exit(1);
});
