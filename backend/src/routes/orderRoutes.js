const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { requireAuth } = require('../middleware/auth');

router.get('/my-orders', requireAuth, orderController.getMyOrders);
router.get('/my-tickets', requireAuth, orderController.getMyTickets);
router.get('/:id', requireAuth, orderController.getOrderById);
// Public ticket verification (e.g. check-in scanners)
router.get('/tickets/:id/verify', orderController.verifyTicket);

module.exports = router;
