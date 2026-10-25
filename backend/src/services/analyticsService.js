const db = require('../config/database');

/**
 * Computes multi-tenant revenue analytics, conversion rates, and inventory metrics
 */
async function getAnalytics({ role, tenantId = null, eventId = null }) {
  let eventFilter = '';
  let orderFilter = '';
  let resFilter = '';
  const params = [];
  const orderParams = [];
  const resParams = [];

  // Multi-Tenant Isolation: Organizers are restricted to their tenant
  if (role === 'ORGANIZER' && tenantId) {
    eventFilter = 'WHERE e.tenant_id = ?';
    orderFilter = 'WHERE o.tenant_id = ?';
    resFilter = 'WHERE e.tenant_id = ?';
    params.push(tenantId);
    orderParams.push(tenantId);
    resParams.push(tenantId);
  } else if (tenantId) {
    // Admin filtering by specific tenant
    eventFilter = 'WHERE e.tenant_id = ?';
    orderFilter = 'WHERE o.tenant_id = ?';
    resFilter = 'WHERE e.tenant_id = ?';
    params.push(tenantId);
    orderParams.push(tenantId);
    resParams.push(tenantId);
  }

  if (eventId) {
    eventFilter += eventFilter ? ' AND e.id = ?' : 'WHERE e.id = ?';
    orderFilter += orderFilter ? ' AND o.event_id = ?' : 'WHERE o.event_id = ?';
    resFilter += resFilter ? ' AND r.event_id = ?' : 'WHERE r.event_id = ?';
    params.push(eventId);
    orderParams.push(eventId);
    resParams.push(eventId);
  }

  // 1. Summary Revenue & Order KPIs
  const summarySql = `
    SELECT
      COUNT(o.id) as total_orders,
      COALESCE(SUM(o.quantity), 0) as total_tickets_sold,
      COALESCE(SUM(o.total_amount), 0) as total_revenue
    FROM orders o
    ${orderFilter}
  `;
  const summary = (await db.queryOne(summarySql, orderParams)) || {
    total_orders: 0,
    total_tickets_sold: 0,
    total_revenue: 0
  };

  // 2. Active Events Count
  const eventsCountSql = `
    SELECT COUNT(e.id) as active_events
    FROM events e
    ${eventFilter}
  `;
  const eventCountRes = await db.queryOne(eventsCountSql, params);
  const activeEventsCount = eventCountRes ? eventCountRes.active_events : 0;

  // 3. Ticket Conversion Funnel (Reservations vs Confirmed vs Expired vs Cancelled vs Held)
  const funnelSql = `
    SELECT
      r.status,
      COUNT(r.id) as count,
      COALESCE(SUM(r.quantity), 0) as total_tickets,
      COALESCE(SUM(r.total_amount), 0) as potential_amount
    FROM reservations r
    JOIN events e ON r.event_id = e.id
    ${resFilter}
    GROUP BY r.status
  `;
  const funnelRows = await db.query(funnelSql, resParams);

  let totalReservations = 0;
  let confirmedReservations = 0;
  let expiredReservations = 0;
  let cancelledReservations = 0;
  let activeHeldReservations = 0;

  for (const row of funnelRows) {
    const c = parseInt(row.count, 10);
    totalReservations += c;
    if (row.status === 'CONFIRMED') confirmedReservations = c;
    else if (row.status === 'EXPIRED') expiredReservations = c;
    else if (row.status === 'CANCELLED') cancelledReservations = c;
    else if (row.status === 'HELD') activeHeldReservations = c;
  }

  const conversionRate = totalReservations > 0
    ? parseFloat(((confirmedReservations / totalReservations) * 100).toFixed(1))
    : 0;

  const abandonmentRate = totalReservations > 0
    ? parseFloat(((expiredReservations / totalReservations) * 100).toFixed(1))
    : 0;

  // 4. Revenue & Inventory by Ticket Tier
  const tierSql = `
    SELECT
      t.id,
      t.name as tier_name,
      t.price,
      t.total_quantity,
      t.available_quantity,
      t.reserved_quantity,
      t.sold_quantity,
      e.title as event_title,
      e.id as event_id,
      (t.sold_quantity * t.price) as tier_revenue
    FROM ticket_tiers t
    JOIN events e ON t.event_id = e.id
    ${eventFilter}
    ORDER BY t.created_at ASC
  `;
  const tiers = await db.query(tierSql, params);

  // 5. Daily Sales Timeline
  const isPg = db.isPostgres();
  const dateExpr = isPg ? "TO_CHAR(o.created_at, 'YYYY-MM-DD')" : "substr(o.created_at, 1, 10)";
  const timelineSql = `
    SELECT
      ${dateExpr} as sales_date,
      COUNT(o.id) as orders_count,
      SUM(o.quantity) as tickets_count,
      SUM(o.total_amount) as daily_revenue
    FROM orders o
    ${orderFilter}
    GROUP BY ${dateExpr}
    ORDER BY sales_date ASC
  `;
  const timeline = await db.query(timelineSql, orderParams);

  // 6. Recent Orders Activity Stream
  const recentOrdersSql = `
    SELECT
      o.id,
      o.order_number,
      o.quantity,
      o.total_amount,
      o.status,
      o.created_at,
      u.name as attendee_name,
      u.email as attendee_email,
      e.title as event_title,
      t.name as tier_name
    FROM orders o
    JOIN users u ON o.user_id = u.id
    JOIN events e ON o.event_id = e.id
    JOIN ticket_tiers t ON o.ticket_tier_id = t.id
    ${orderFilter}
    ORDER BY o.created_at DESC
    LIMIT 10
  `;
  const recentOrders = await db.query(recentOrdersSql, orderParams);

  return {
    kpis: {
      totalRevenue: parseFloat(summary.total_revenue || 0),
      totalTicketsSold: parseInt(summary.total_tickets_sold || 0, 10),
      totalOrders: parseInt(summary.total_orders || 0, 10),
      activeEvents: parseInt(activeEventsCount, 10),
      activeHolds: activeHeldReservations
    },
    funnel: {
      totalReservations,
      confirmedReservations,
      expiredReservations,
      cancelledReservations,
      activeHeldReservations,
      conversionRate,
      abandonmentRate
    },
    tierBreakdown: tiers.map((t) => ({
      ...t,
      price: parseFloat(t.price),
      tierRevenue: parseFloat(t.tier_revenue || 0),
      utilizationRate: t.total_quantity > 0
        ? parseFloat(((t.sold_quantity / t.total_quantity) * 100).toFixed(1))
        : 0
    })),
    timeline: timeline.map((tl) => ({
      ...tl,
      daily_revenue: parseFloat(tl.daily_revenue || 0),
      tickets_count: parseInt(tl.tickets_count || 0, 10),
      orders_count: parseInt(tl.orders_count || 0, 10)
    })),
    recentOrders
  };
}

module.exports = {
  getAnalytics
};
