const workerService = require('../services/workerService');

async function triggerCleanup(req, res) {
  try {
    const result = await workerService.cleanupExpiredHolds();
    return res.json({
      message: `Hold expiration cleanup completed. Released ${result.releasedCount} expired hold(s).`,
      result
    });
  } catch (err) {
    console.error('[Worker Controller] Cleanup error:', err);
    return res.status(500).json({ error: 'Failed to execute cleanup task.' });
  }
}

module.exports = {
  triggerCleanup
};
