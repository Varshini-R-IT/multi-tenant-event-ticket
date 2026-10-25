const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Mock payment gateway checkout
router.post('/charge', paymentController.processPayment);
// Asynchronous webhook simulation callback
router.post('/webhook', paymentController.simulateWebhook);

module.exports = router;
