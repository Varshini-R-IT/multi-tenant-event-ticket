const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { requireAuth } = require('../middleware/auth');
const { requireRole, enforceTenantScope } = require('../middleware/rbac');

// Organizers and Admins can access analytics
router.get(
  '/dashboard',
  requireAuth,
  requireRole('ADMIN', 'ORGANIZER'),
  enforceTenantScope,
  analyticsController.getDashboardAnalytics
);

module.exports = router;
