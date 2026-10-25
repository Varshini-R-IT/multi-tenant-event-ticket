const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { getCached, setCached, invalidateEvent, invalidateAllEvents, TTL } = require('../services/cacheService');

/**
 * Public: List all active published events (with Redis Caching & X-Cache headers)
 */
async function getEvents(req, res) {
  try {
    const cacheKey = 'events:active';
    const cachedData = await getCached(cacheKey);

    if (cachedData) {
      res.setHeader('X-Cache', 'HIT');
      return res.json({ events: cachedData, source: 'cache' });
    }

    const events = await db.query(`
      SELECT
        e.id, e.title, e.description, e.category, e.venue, e.banner_url,
        e.start_date, e.end_date, e.sales_cutoff_date, e.status, e.created_at,
        t.name as organizer_name, t.slug as organizer_slug
      FROM events e
      JOIN tenants t ON e.tenant_id = t.id
      WHERE e.status = 'PUBLISHED'
      ORDER BY e.start_date ASC
    `);

    // Attach tier summaries (minimum price, total remaining capacity)
    for (const evt of events) {
      const tiers = await db.query(
        `SELECT id, name, price, total_quantity, available_quantity, reserved_quantity, sold_quantity
         FROM ticket_tiers
         WHERE event_id = ?
         ORDER BY price ASC`,
        [evt.id]
      );
      evt.tiers = tiers.map((t) => ({
        ...t,
        price: parseFloat(t.price),
        total_quantity: parseInt(t.total_quantity, 10),
        available_quantity: parseInt(t.available_quantity, 10),
        reserved_quantity: parseInt(t.reserved_quantity, 10),
        sold_quantity: parseInt(t.sold_quantity, 10)
      }));

      evt.minPrice = tiers.length > 0 ? Math.min(...tiers.map((t) => parseFloat(t.price))) : 0;
      evt.totalAvailable = tiers.reduce((acc, t) => acc + parseInt(t.available_quantity, 10), 0);
      evt.totalCapacity = tiers.reduce((acc, t) => acc + parseInt(t.total_quantity, 10), 0);
    }

    await setCached(cacheKey, events, TTL.ACTIVE_EVENTS);
    res.setHeader('X-Cache', 'MISS');
    return res.json({ events, source: 'database' });
  } catch (err) {
    console.error('[Event] getEvents error:', err);
    return res.status(500).json({ error: 'Failed to retrieve events.' });
  }
}

/**
 * Public: Get single event by ID with full ticket tier inventory (with Redis Caching)
 */
async function getEventById(req, res) {
  try {
    const { id } = req.params;
    const cacheKey = `event:${id}`;
    const cachedEvent = await getCached(cacheKey);

    if (cachedEvent) {
      res.setHeader('X-Cache', 'HIT');
      return res.json({ event: cachedEvent, source: 'cache' });
    }

    const event = await db.queryOne(
      `SELECT
        e.id, e.tenant_id, e.organizer_id, e.title, e.description, e.category,
        e.venue, e.banner_url, e.start_date, e.end_date, e.sales_cutoff_date,
        e.status, e.created_at, e.updated_at,
        t.name as organizer_name, t.slug as organizer_slug,
        u.name as creator_name
       FROM events e
       JOIN tenants t ON e.tenant_id = t.id
       JOIN users u ON e.organizer_id = u.id
       WHERE e.id = ?`,
      [id]
    );

    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    const tiers = await db.query(
      `SELECT id, name, description, price, total_quantity, available_quantity, reserved_quantity, sold_quantity, max_per_order
       FROM ticket_tiers
       WHERE event_id = ?
       ORDER BY price ASC`,
      [id]
    );

    event.tiers = tiers.map((t) => ({
      ...t,
      price: parseFloat(t.price),
      total_quantity: parseInt(t.total_quantity, 10),
      available_quantity: parseInt(t.available_quantity, 10),
      reserved_quantity: parseInt(t.reserved_quantity, 10),
      sold_quantity: parseInt(t.sold_quantity, 10),
      max_per_order: parseInt(t.max_per_order, 10)
    }));

    await setCached(cacheKey, event, TTL.EVENT_DETAIL);
    res.setHeader('X-Cache', 'MISS');
    return res.json({ event, source: 'database' });
  } catch (err) {
    console.error('[Event] getEventById error:', err);
    return res.status(500).json({ error: 'Failed to retrieve event details.' });
  }
}

/**
 * Organizers/Admins: Create event with multiple ticket tiers
 */
async function createEvent(req, res) {
  try {
    const {
      title,
      description,
      category = 'Conference',
      venue = 'Online / Main Hall',
      bannerUrl,
      startDate,
      endDate,
      salesCutoffDate,
      tiers = []
    } = req.body;

    if (!title || !startDate) {
      return res.status(400).json({ error: 'Event title and start date are required.' });
    }

    if (!tiers || tiers.length === 0) {
      return res.status(400).json({ error: 'At least one ticket tier (e.g. VIP, General Admission) is required.' });
    }

    const eventId = `evt_${uuidv4().substring(0, 10)}`;
    const tenantId = req.user.role === 'ADMIN' && req.body.tenantId ? req.body.tenantId : req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant / Organization ID is missing for this event.' });
    }

    const now = new Date().toISOString();
    const finalCutoff = salesCutoffDate || startDate;

    const createdEvent = await db.transaction(async (tx) => {
      await tx.run(
        `INSERT INTO events (
          id, tenant_id, organizer_id, title, description, category, venue,
          banner_url, start_date, end_date, sales_cutoff_date, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PUBLISHED', ?, ?)`,
        [
          eventId,
          tenantId,
          req.user.id,
          title,
          description || '',
          category,
          venue,
          bannerUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
          new Date(startDate).toISOString(),
          endDate ? new Date(endDate).toISOString() : new Date(startDate).toISOString(),
          new Date(finalCutoff).toISOString(),
          now,
          now
        ]
      );

      const createdTiers = [];
      for (const t of tiers) {
        const tierId = `tier_${uuidv4().substring(0, 10)}`;
        const totalQty = parseInt(t.totalQuantity || t.total_quantity || 100, 10);
        const price = parseFloat(t.price || 0);
        const maxPerOrder = parseInt(t.maxPerOrder || t.max_per_order || 10, 10);

        await tx.run(
          `INSERT INTO ticket_tiers (
            id, event_id, name, description, price, total_quantity,
            available_quantity, reserved_quantity, sold_quantity, max_per_order, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
          [
            tierId,
            eventId,
            t.name || 'General Admission',
            t.description || '',
            price,
            totalQty,
            totalQty,
            maxPerOrder,
            now
          ]
        );

        createdTiers.push({
          id: tierId,
          eventId,
          name: t.name,
          price,
          total_quantity: totalQty,
          available_quantity: totalQty,
          reserved_quantity: 0,
          sold_quantity: 0
        });
      }

      return {
        id: eventId,
        tenantId,
        title,
        status: 'PUBLISHED',
        tiers: createdTiers
      };
    });

    await invalidateAllEvents();

    return res.status(201).json({
      message: 'Event and ticket tiers created successfully.',
      event: createdEvent
    });
  } catch (err) {
    console.error('[Event] createEvent error:', err);
    return res.status(500).json({ error: 'Failed to create event.' });
  }
}

/**
 * Organizers/Admins: Update event
 */
async function updateEvent(req, res) {
  try {
    const { id } = req.params;
    const { title, description, category, venue, bannerUrl, salesCutoffDate, status } = req.body;

    const event = await db.queryOne('SELECT * FROM events WHERE id = ?', [id]);
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    // Role check: Organizer can only edit their own tenant's events
    if (req.user.role === 'ORGANIZER' && event.tenant_id !== req.user.tenantId) {
      return res.status(403).json({ error: 'Unauthorized to edit events of another organization.' });
    }

    const now = new Date().toISOString();

    await db.run(
      `UPDATE events
       SET title = COALESCE(?, title),
           description = COALESCE(?, description),
           category = COALESCE(?, category),
           venue = COALESCE(?, venue),
           banner_url = COALESCE(?, banner_url),
           sales_cutoff_date = COALESCE(?, sales_cutoff_date),
           status = COALESCE(?, status),
           updated_at = ?
       WHERE id = ?`,
      [title, description, category, venue, bannerUrl, salesCutoffDate, status, now, id]
    );

    await invalidateEvent(id);

    return res.json({ message: 'Event updated successfully.' });
  } catch (err) {
    console.error('[Event] updateEvent error:', err);
    return res.status(500).json({ error: 'Failed to update event.' });
  }
}

/**
 * Organizers/Admins: List events scoped to Organizer's tenant
 */
async function getOrganizerEvents(req, res) {
  try {
    let sql = `
      SELECT
        e.id, e.title, e.category, e.venue, e.banner_url, e.start_date,
        e.sales_cutoff_date, e.status, e.created_at,
        t.name as tenant_name,
        COALESCE(SUM(tt.total_quantity), 0) as total_capacity,
        COALESCE(SUM(tt.available_quantity), 0) as total_available,
        COALESCE(SUM(tt.sold_quantity), 0) as total_sold
      FROM events e
      JOIN tenants t ON e.tenant_id = t.id
      LEFT JOIN ticket_tiers tt ON e.id = tt.event_id
    `;
    const params = [];

    if (req.user.role === 'ORGANIZER') {
      sql += ' WHERE e.tenant_id = ?';
      params.push(req.user.tenantId);
    } else if (req.query.tenantId) {
      sql += ' WHERE e.tenant_id = ?';
      params.push(req.query.tenantId);
    }

    sql += ' GROUP BY e.id ORDER BY e.created_at DESC';

    const events = await db.query(sql, params);
    return res.json({ events });
  } catch (err) {
    console.error('[Event] getOrganizerEvents error:', err);
    return res.status(500).json({ error: 'Failed to fetch organizer events.' });
  }
}

module.exports = {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  getOrganizerEvents
};
