const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { requireAuth } = require('../middleware/auth');
const { requireRole, enforceTenantScope } = require('../middleware/rbac');

// Public endpoints (with Redis Caching & X-Cache headers)
router.get('/', eventController.getEvents);
router.get('/:id', eventController.getEventById);

// Organizer / Admin endpoints
router.post('/', requireAuth, requireRole('ADMIN', 'ORGANIZER'), enforceTenantScope, eventController.createEvent);
router.put('/:id', requireAuth, requireRole('ADMIN', 'ORGANIZER'), enforceTenantScope, eventController.updateEvent);
router.get('/manage/my-events', requireAuth, requireRole('ADMIN', 'ORGANIZER'), enforceTenantScope, eventController.getOrganizerEvents);

module.exports = router;
