const analyticsService = require('../services/analyticsService');
const db = require('../config/database');

async function getDashboardAnalytics(req, res) {
  try {
    const role = req.user.role;
    const tenantId = role === 'ORGANIZER' ? req.user.tenantId : (req.query.tenantId || null);
    const eventId = req.query.eventId || null;

    const data = await analyticsService.getAnalytics({
      role,
      tenantId,
      eventId
    });

    // If Admin, also provide list of all tenants for easy dropdown filtering
    let tenants = [];
    if (role === 'ADMIN') {
      tenants = await db.query('SELECT id, name, slug FROM tenants ORDER BY name ASC');
    }

    return res.json({
      analytics: data,
      tenants,
      scope: {
        role,
        tenantId,
        eventId
      }
    });
  } catch (err) {
    console.error('[Analytics] Error calculating analytics:', err);
    return res.status(500).json({ error: 'Failed to generate analytics dashboard data.' });
  }
}

module.exports = {
  getDashboardAnalytics
};
