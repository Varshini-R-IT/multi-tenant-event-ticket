const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');

// Reservation creation (can be done with auth token or anonymous session)
router.post('/hold', reservationController.createReservation);
router.get('/:id', reservationController.getReservation);
router.delete('/:id/release', reservationController.releaseReservation);

module.exports = router;
