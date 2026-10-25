const reservationService = require('../services/reservationService');

async function createReservation(req, res) {
  try {
    const { tierId, quantity = 1 } = req.body;

    if (!tierId) {
      return res.status(400).json({ error: 'tierId is required.' });
    }

    // Identify user (from token, or temporary attendee identifier)
    const userId = req.user ? req.user.id : (req.body.userId || `guest_${Date.now()}`);

    const hold = await reservationService.createHold({
      tierId,
      userId,
      quantity
    });

    return res.status(201).json({
      message: 'Tickets successfully placed on a 10-minute temporary reservation hold.',
      hold
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    if (statusCode === 409) {
      return res.status(409).json({
        error: err.message,
        code: 'TICKETS_UNAVAILABLE',
        available: err.available !== undefined ? err.available : 0
      });
    }

    if (statusCode === 429) {
      return res.status(429).json({
        error: err.message,
        code: 'HIGH_CONTENTION'
      });
    }

    console.error('[Reservation] createReservation error:', err.message);
    return res.status(statusCode).json({ error: err.message || 'Failed to create reservation hold.' });
  }
}

async function getReservation(req, res) {
  try {
    const { id } = req.params;
    const reservation = await reservationService.getReservationById(id);

    if (!reservation) {
      return res.status(404).json({ error: 'Reservation hold not found.' });
    }

    return res.json({ reservation });
  } catch (err) {
    console.error('[Reservation] getReservation error:', err);
    return res.status(500).json({ error: 'Failed to retrieve reservation.' });
  }
}

async function releaseReservation(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user ? req.user.id : null;
    const result = await reservationService.releaseHold(id, userId);

    return res.json(result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ error: err.message || 'Failed to release reservation hold.' });
  }
}

module.exports = {
  createReservation,
  getReservation,
  releaseReservation
};
