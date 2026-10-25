const db = require('../config/database');

async function createSchema() {
  const isPg = db.isPostgres();

  const timestampType = isPg ? 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP' : 'DATETIME DEFAULT CURRENT_TIMESTAMP';
  const numericType = isPg ? 'NUMERIC(10, 2)' : 'REAL';

  const queries = [
    // 1. Tenants (Organizations)
    `CREATE TABLE IF NOT EXISTS tenants (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      created_at ${timestampType}
    );`,

    // 2. Users (RBAC: ADMIN, ORGANIZER, ATTENDEE)
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'ATTENDEE',
      created_at ${timestampType}
    );`,

    // 3. Events
    `CREATE TABLE IF NOT EXISTS events (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL,
      organizer_id VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(64) DEFAULT 'Conference',
      venue VARCHAR(255) DEFAULT 'Virtual / Online',
      banner_url TEXT,
      start_date ${timestampType},
      end_date ${timestampType},
      sales_cutoff_date ${timestampType},
      status VARCHAR(32) DEFAULT 'PUBLISHED',
      created_at ${timestampType},
      updated_at ${timestampType}
    );`,

    // 4. Ticket Tiers (Inventory with available, reserved, sold counts)
    `CREATE TABLE IF NOT EXISTS ticket_tiers (
      id VARCHAR(64) PRIMARY KEY,
      event_id VARCHAR(64) NOT NULL,
      name VARCHAR(128) NOT NULL,
      description TEXT,
      price ${numericType} NOT NULL DEFAULT 0.00,
      total_quantity INTEGER NOT NULL,
      available_quantity INTEGER NOT NULL,
      reserved_quantity INTEGER NOT NULL DEFAULT 0,
      sold_quantity INTEGER NOT NULL DEFAULT 0,
      max_per_order INTEGER NOT NULL DEFAULT 10,
      created_at ${timestampType}
    );`,

    // 5. Temporary Reservations (10-minute hold engine)
    `CREATE TABLE IF NOT EXISTS reservations (
      id VARCHAR(64) PRIMARY KEY,
      ticket_tier_id VARCHAR(64) NOT NULL,
      event_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price ${numericType} NOT NULL,
      total_amount ${numericType} NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'HELD', -- 'HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED'
      hold_token VARCHAR(128) UNIQUE NOT NULL,
      created_at ${timestampType},
      expires_at ${timestampType},
      confirmed_at ${timestampType}
    );`,

    // 6. Confirmed Orders
    `CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(64) PRIMARY KEY,
      order_number VARCHAR(64) UNIQUE NOT NULL,
      reservation_id VARCHAR(64) NOT NULL,
      event_id VARCHAR(64) NOT NULL,
      tenant_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      ticket_tier_id VARCHAR(64) NOT NULL,
      quantity INTEGER NOT NULL,
      total_amount ${numericType} NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'PAID', -- 'PAID', 'REFUNDED'
      created_at ${timestampType}
    );`,

    // 7. Individual Digital Tickets (with Unique QR code payload)
    `CREATE TABLE IF NOT EXISTS tickets (
      id VARCHAR(64) PRIMARY KEY,
      order_id VARCHAR(64) NOT NULL,
      ticket_number VARCHAR(64) UNIQUE NOT NULL,
      event_id VARCHAR(64) NOT NULL,
      ticket_tier_id VARCHAR(64) NOT NULL,
      attendee_name VARCHAR(255) NOT NULL,
      attendee_email VARCHAR(255) NOT NULL,
      qr_code TEXT NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'VALID', -- 'VALID', 'CHECKED_IN', 'REVOKED'
      created_at ${timestampType}
    );`,

    // 8. Payment & Gateway Transactions
    `CREATE TABLE IF NOT EXISTS transactions (
      id VARCHAR(64) PRIMARY KEY,
      order_id VARCHAR(64),
      reservation_id VARCHAR(64) NOT NULL,
      amount ${numericType} NOT NULL,
      currency VARCHAR(10) DEFAULT 'USD',
      payment_method VARCHAR(64) DEFAULT 'MOCK_CREDIT_CARD',
      gateway_ref VARCHAR(128) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'SUCCESS', 'FAILED'
      failure_reason TEXT,
      created_at ${timestampType}
    );`
  ];

  for (const q of queries) {
    await db.run(q);
  }

  // Create Indexes for high-performance lookups & concurrency checks
  const indexQueries = [
    `CREATE INDEX IF NOT EXISTS idx_events_tenant ON events(tenant_id);`,
    `CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);`,
    `CREATE INDEX IF NOT EXISTS idx_tiers_event ON ticket_tiers(event_id);`,
    `CREATE INDEX IF NOT EXISTS idx_res_status_exp ON reservations(status, expires_at);`,
    `CREATE INDEX IF NOT EXISTS idx_res_user ON reservations(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_tickets_order ON tickets(order_id);`
  ];

  for (const idx of indexQueries) {
    try {
      await db.run(idx);
    } catch (e) {
      // index might already exist
    }
  }

  console.log('[Schema] All tables and indexes initialized successfully.');
}

module.exports = { createSchema };
