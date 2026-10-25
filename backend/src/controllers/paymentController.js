const paymentService = require('../services/paymentService');

async function processPayment(req, res) {
  try {
    const {
      reservationId,
      cardNumber = '4242424242424242',
      cardHolder,
      simulationMode = 'APPROVE',
      webhookOutcome = 'APPROVE'
    } = req.body;

    if (!reservationId) {
      return res.status(400).json({ error: 'reservationId is required for checkout.' });
    }

    const attendeeName = cardHolder || (req.user ? req.user.name : 'Valued Attendee');

    const result = await paymentService.processPayment({
      reservationId,
      cardNumber,
      cardHolder: attendeeName,
      simulationMode,
      webhookOutcome
    });

    return res.json(result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    console.error('[Payment] processPayment error:', err.message);
    return res.status(statusCode).json({ error: err.message || 'Payment processing failed.' });
  }
}

async function simulateWebhook(req, res) {
  try {
    const { reservationId, transactionId, outcome = 'APPROVE' } = req.body;

    if (!reservationId) {
      return res.status(400).json({ error: 'reservationId is required.' });
    }

    const result = await paymentService.handleAsyncWebhook({
      reservationId,
      transactionId,
      outcome,
      cardNumber: '4242424242424242',
      cardHolder: 'Async Webhook User'
    });

    return res.json({ message: 'Webhook processed successfully.', result });
  } catch (err) {
    console.error('[Payment] Webhook simulation error:', err.message);
    return res.status(500).json({ error: err.message || 'Webhook processing failed.' });
  }
}

module.exports = {
  processPayment,
  simulateWebhook
};
