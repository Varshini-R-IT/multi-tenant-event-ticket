const express = require('express');
const router = express.Router();
const workerController = require('../controllers/workerController');

// Trigger hold expiration cleanup on demand (useful for testing hold expiry instantly)
router.post('/cleanup-holds', workerController.triggerCleanup);

module.exports = router;
