const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const db = require('./config/database');
const { createSchema } = require('./models/schema');

async function seed() {
  console.log('[Seed] Initializing database...');
  await db.initDatabase();
  await createSchema();

  console.log('[Seed] Seeding multi-tenant demonstration data...');

  const passwordHash = await bcrypt.hash('admin123', 10);
  const organizerHash = await bcrypt.hash('organizer123', 10);
  const attendeeHash = await bcrypt.hash('attendee123', 10);

  const now = new Date();
  const futureDate = (days) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  const pastDate = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

  // 1. Tenants
  const tenants = [
    {
      id: 'ten_techsummit',
      name: 'Global Tech Summits Inc.',
      slug: 'global-tech-summits',
      description: 'Premier enterprise technology and developer conferences worldwide.'
    },
    {
      id: 'ten_musicfest',
      name: 'NeonWave Festival Media',
      slug: 'neonwave-festivals',
      description: 'Immersive electronic music festivals and audiovisual experiences.'
    },
    {
      id: 'ten_apexai',
      name: 'Apex AI & Data Institute',
      slug: 'apex-ai-institute',
      description: 'Frontier machine learning and generative artificial intelligence symposiums.'
    }
  ];

  for (const t of tenants) {
    await db.run(
      `INSERT OR REPLACE INTO tenants (id, name, slug, description, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [t.id, t.name, t.slug, t.description, now.toISOString()]
    );
  }

  // 2. Users (Admin, Organizers, Attendees)
  const users = [
    {
      id: 'usr_admin',
      tenantId: null,
      email: 'admin@eventreserve.com',
      passwordHash: passwordHash,
      name: 'Alex Vance (Global Admin)',
      role: 'ADMIN'
    },
    {
      id: 'usr_sarah',
      tenantId: 'ten_techsummit',
      email: 'sarah@techsummit.io',
      passwordHash: organizerHash,
      name: 'Sarah Connor',
      role: 'ORGANIZER'
    },
    {
      id: 'usr_marcus',
      tenantId: 'ten_musicfest',
      email: 'marcus@neonwave.live',
      passwordHash: organizerHash,
      name: 'Marcus Chen',
      role: 'ORGANIZER'
    },
    {
      id: 'usr_alice',
      tenantId: null,
      email: 'alice@example.com',
      passwordHash: attendeeHash,
      name: 'Alice Johnson',
      role: 'ATTENDEE'
    },
    {
      id: 'usr_bob',
      tenantId: null,
      email: 'bob@example.com',
      passwordHash: attendeeHash,
      name: 'Bob Martinez',
      role: 'ATTENDEE'
    }
  ];

  for (const u of users) {
    await db.run(
      `INSERT OR REPLACE INTO users (id, tenant_id, email, password_hash, name, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [u.id, u.tenantId, u.email, u.passwordHash, u.name, u.role, now.toISOString()]
    );
  }

  // 3. Events
  const events = [
    {
      id: 'evt_ai_cloud_2026',
      tenantId: 'ten_techsummit',
      organizerId: 'usr_sarah',
      title: 'Global AI & Cloud Architecture Summit 2026',
      description: 'The world premier gathering of cloud systems engineers, LLM infrastructure pioneers, and distributed computing experts. Featuring 40+ keynote talks and hands-on architecture masterclasses.',
      category: 'Technology',
      venue: 'Moscone Convention Center, San Francisco & Worldwide Stream',
      bannerUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
      startDate: futureDate(14),
      endDate: futureDate(16),
      salesCutoffDate: futureDate(13)
    },
    {
      id: 'evt_neonwave_fest',
      tenantId: 'ten_musicfest',
      organizerId: 'usr_marcus',
      title: 'NeonWave Cyberpunk Electronic Music Festival',
      description: '3 days of non-stop synthwave, progressive house, holographic laser spectacles, and cyber-art installations under the desert night sky.',
      category: 'Music & Arts',
      venue: 'CyberArena Pavilion, Austin TX',
      bannerUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80',
      startDate: futureDate(30),
      endDate: futureDate(33),
      salesCutoffDate: futureDate(29)
    },
    {
      id: 'evt_fintech_forum',
      tenantId: 'ten_techsummit',
      organizerId: 'usr_sarah',
      title: 'NextGen Autonomous Finance & Payments Forum',
      description: 'High-level roundtables on real-time gross settlement, algorithmic treasury management, and high-throughput transaction engines.',
      category: 'Finance',
      venue: 'Grand Hyatt Financial District, New York NY',
      bannerUrl: 'https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80',
      startDate: futureDate(45),
      endDate: futureDate(46),
      salesCutoffDate: futureDate(44)
    }
  ];

  for (const e of events) {
    await db.run(
      `INSERT OR REPLACE INTO events (
        id, tenant_id, organizer_id, title, description, category, venue,
        banner_url, start_date, end_date, sales_cutoff_date, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PUBLISHED', ?, ?)`,
      [
        e.id,
        e.tenantId,
        e.organizerId,
        e.title,
        e.description,
        e.category,
        e.venue,
        e.bannerUrl,
        e.startDate,
        e.endDate,
        e.salesCutoffDate,
        now.toISOString(),
        now.toISOString()
      ]
    );
  }

  // 4. Ticket Tiers
  const tiers = [
    // Event 1 Tiers
    {
      id: 'tier_ai_vip',
      eventId: 'evt_ai_cloud_2026',
      name: 'VIP All-Access Pass',
      description: 'Front-row keynote seats, Speaker Lounge access, exclusive dinner gala & complete video recordings archive.',
      price: 499.00,
      totalQuantity: 50,
      availableQuantity: 36,
      reservedQuantity: 2,
      soldQuantity: 12,
      maxPerOrder: 5
    },
    {
      id: 'tier_ai_ga',
      eventId: 'evt_ai_cloud_2026',
      name: 'General Admission',
      description: 'Full conference hall admission, expo floor access, workshop participation and networking receptions.',
      price: 199.00,
      totalQuantity: 250,
      availableQuantity: 185,
      reservedQuantity: 5,
      soldQuantity: 60,
      maxPerOrder: 8
    },
    {
      id: 'tier_ai_earlybird',
      eventId: 'evt_ai_cloud_2026',
      name: 'Early Bird Pass (Sold Out)',
      description: 'Discounted early pass for the first 50 registered engineers.',
      price: 99.00,
      totalQuantity: 50,
      availableQuantity: 0,
      reservedQuantity: 0,
      soldQuantity: 50,
      maxPerOrder: 5
    },
    // Event 2 Tiers (Great for low-quantity concurrency test)
    {
      id: 'tier_neon_backstage',
      eventId: 'evt_neonwave_fest',
      name: 'Ultra VIP Backstage Lounge',
      description: 'Artist backstage hospitality, private stage-side viewing deck, open craft bar & express festival entry.',
      price: 350.00,
      totalQuantity: 15,
      availableQuantity: 3, // Only 3 left! Perfect for testing race conditions
      reservedQuantity: 2,
      soldQuantity: 10,
      maxPerOrder: 4
    },
    {
      id: 'tier_neon_ga',
      eventId: 'evt_neonwave_fest',
      name: '3-Day General Festival Pass',
      description: 'Admission to all 4 stages across all 3 festival days and immersive laser arenas.',
      price: 160.00,
      totalQuantity: 400,
      availableQuantity: 240,
      reservedQuantity: 10,
      soldQuantity: 150,
      maxPerOrder: 6
    },
    // Event 3 Tiers
    {
      id: 'tier_fin_exec',
      eventId: 'evt_fintech_forum',
      name: 'Executive Delegate Pass',
      description: 'C-Suite networking breakfasts, investor pitch rooms and private advisory sessions.',
      price: 599.00,
      totalQuantity: 40,
      availableQuantity: 22,
      reservedQuantity: 0,
      soldQuantity: 18,
      maxPerOrder: 4
    }
  ];

  for (const t of tiers) {
    await db.run(
      `INSERT OR REPLACE INTO ticket_tiers (
        id, event_id, name, description, price, total_quantity,
        available_quantity, reserved_quantity, sold_quantity, max_per_order, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        t.id,
        t.eventId,
        t.name,
        t.description,
        t.price,
        t.totalQuantity,
        t.availableQuantity,
        t.reservedQuantity,
        t.soldQuantity,
        t.maxPerOrder,
        now.toISOString()
      ]
    );
  }

  // 5. Pre-seeded Orders and Digital Tickets with QR Codes (For Alice)
  const orderId = 'ord_alice_sample';
  const orderNumber = 'ORD-DEMO-2026-ALICE';
  const resId = 'res_alice_demo';

  await db.run(
    `INSERT OR REPLACE INTO reservations (
      id, ticket_tier_id, event_id, user_id, quantity, unit_price,
      total_amount, status, hold_token, created_at, expires_at, confirmed_at
    ) VALUES (?, 'tier_ai_vip', 'evt_ai_cloud_2026', 'usr_alice', 2, 499.00, 998.00, 'CONFIRMED', 'ht_demo_alice', ?, ?, ?)`,
    [resId, pastDate(2), pastDate(2), pastDate(2)]
  );

  await db.run(
    `INSERT OR REPLACE INTO orders (
      id, order_number, reservation_id, event_id, tenant_id, user_id,
      ticket_tier_id, quantity, total_amount, status, created_at
    ) VALUES (?, ?, ?, 'evt_ai_cloud_2026', 'ten_techsummit', 'usr_alice', 'tier_ai_vip', 2, 998.00, 'PAID', ?)`,
    [orderId, orderNumber, resId, pastDate(2)]
  );

  // Generate 2 QR Codes for Alice's tickets
  for (let i = 1; i <= 2; i++) {
    const ticketId = `tck_alice_${i}`;
    const ticketNumber = `TCK-AI26-00${i}89`;
    const qrData = JSON.stringify({
      ticketId,
      ticketNumber,
      eventId: 'evt_ai_cloud_2026',
      eventTitle: 'Global AI & Cloud Architecture Summit 2026',
      tierName: 'VIP All-Access Pass',
      attendeeName: 'Alice Johnson',
      seat: `VIP-${i}-RowA`
    });

    const qrCodeUrl = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'M',
      width: 256,
      margin: 2
    });

    await db.run(
      `INSERT OR REPLACE INTO tickets (
        id, order_id, ticket_number, event_id, ticket_tier_id,
        attendee_name, attendee_email, qr_code, status, created_at
      ) VALUES (?, ?, ?, 'evt_ai_cloud_2026', 'tier_ai_vip', 'Alice Johnson', 'alice@example.com', ?, 'VALID', ?)`,
      [ticketId, orderId, ticketNumber, qrCodeUrl, pastDate(2)]
    );
  }

  // Pre-seed a Transaction for the order
  await db.run(
    `INSERT OR REPLACE INTO transactions (
      id, order_id, reservation_id, amount, currency, payment_method,
      gateway_ref, status, created_at
    ) VALUES ('txn_alice_sample', ?, ?, 998.00, 'USD', 'MOCK_CARD (****-4242)', 'gw_seed_approved_alice', 'SUCCESS', ?)`,
    [orderId, resId, pastDate(2)]
  );

  console.log('[Seed] Database seeded with tenants, users, events, tiers, and orders!');
  console.log('---------------------------------------------------------');
  console.log('Demo Credentials:');
  console.log('ADMIN:     admin@eventreserve.com   / admin123');
  console.log('ORGANIZER: sarah@techsummit.io      / organizer123');
  console.log('ORGANIZER: marcus@neonwave.live     / organizer123');
  console.log('ATTENDEE:  alice@example.com        / attendee123');
  console.log('ATTENDEE:  bob@example.com          / attendee123');
  console.log('---------------------------------------------------------');
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed Error]:', err);
      process.exit(1);
    });
}

module.exports = { seed };
