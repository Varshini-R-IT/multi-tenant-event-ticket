const db = require('../config/database');

async function getMyOrders(req, res) {
  try {
    const userId = req.user.id;

    const orders = await db.query(
      `SELECT
        o.id, o.order_number, o.quantity, o.total_amount, o.status, o.created_at,
        e.id as event_id, e.title as event_title, e.venue, e.start_date, e.banner_url,
        t.name as tier_name, t.price as unit_price
       FROM orders o
       JOIN events e ON o.event_id = e.id
       JOIN ticket_tiers t ON o.ticket_tier_id = t.id
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC`,
      [userId]
    );

    return res.json({ orders });
  } catch (err) {
    console.error('[Order] getMyOrders error:', err);
    return res.status(500).json({ error: 'Failed to retrieve orders.' });
  }
}

async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    const order = await db.queryOne(
      `SELECT
        o.*,
        e.title as event_title, e.venue, e.start_date, e.banner_url,
        t.name as tier_name
       FROM orders o
       JOIN events e ON o.event_id = e.id
       JOIN ticket_tiers t ON o.ticket_tier_id = t.id
       WHERE o.id = ?`,
      [id]
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Role check: Only the buyer, or organizer of the event, or admin can view
    if (
      req.user.role === 'ATTENDEE' &&
      order.user_id !== req.user.id
    ) {
      return res.status(403).json({ error: 'Unauthorized to view this order.' });
    }

    const tickets = await db.query(
      `SELECT id, ticket_number, attendee_name, attendee_email, qr_code, status, created_at
       FROM tickets
       WHERE order_id = ?`,
      [id]
    );

    const transaction = await db.queryOne(
      `SELECT id, amount, currency, payment_method, gateway_ref, status, created_at
       FROM transactions
       WHERE order_id = ?`,
      [id]
    );

    return res.json({
      order: {
        ...order,
        tickets,
        transaction
      }
    });
  } catch (err) {
    console.error('[Order] getOrderById error:', err);
    return res.status(500).json({ error: 'Failed to retrieve order details.' });
  }
}

async function getMyTickets(req, res) {
  try {
    const userId = req.user.id;

    const tickets = await db.query(
      `SELECT
        t.id, t.ticket_number, t.attendee_name, t.attendee_email, t.qr_code, t.status, t.created_at,
        o.order_number,
        e.id as event_id, e.title as event_title, e.venue, e.start_date, e.banner_url,
        tt.name as tier_name, tt.price
       FROM tickets t
       JOIN orders o ON t.order_id = o.id
       JOIN events e ON t.event_id = e.id
       JOIN ticket_tiers tt ON t.ticket_tier_id = tt.id
       WHERE o.user_id = ?
       ORDER BY e.start_date ASC, t.created_at DESC`,
      [userId]
    );

    return res.json({ tickets });
  } catch (err) {
    console.error('[Order] getMyTickets error:', err);
    return res.status(500).json({ error: 'Failed to retrieve tickets.' });
  }
}

async function verifyTicket(req, res) {
  try {
    const { id } = req.params;

    const ticket = await db.queryOne(
      `SELECT
        t.id, t.ticket_number, t.attendee_name, t.attendee_email, t.status, t.created_at,
        e.title as event_title, e.venue, e.start_date,
        tt.name as tier_name
       FROM tickets t
       JOIN events e ON t.event_id = e.id
       JOIN ticket_tiers tt ON t.ticket_tier_id = tt.id
       WHERE t.id = ? OR t.ticket_number = ?`,
      [id, id]
    );

    if (!ticket) {
      return res.status(404).json({ valid: false, error: 'Ticket not found or invalid.' });
    }

    return res.json({
      valid: ticket.status === 'VALID',
      ticket
    });
  } catch (err) {
    console.error('[Order] verifyTicket error:', err);
    return res.status(500).json({ error: 'Ticket verification error.' });
  }
}

module.exports = {
  getMyOrders,
  getOrderById,
  getMyTickets,
  verifyTicket
};
