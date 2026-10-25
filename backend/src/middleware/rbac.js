/**
 * Role-Based Access Control (RBAC) & Tenant Isolation Middleware
 */

/**
 * Restricts access to specific roles (e.g. 'ADMIN', 'ORGANIZER', 'ATTENDEE')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required.',
        code: 'UNAUTHORIZED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Role '${req.user.role}' is not authorized. Required: [${allowedRoles.join(', ')}]`,
        code: 'FORBIDDEN',
        requiredRoles: allowedRoles,
        currentRole: req.user.role
      });
    }

    next();
  };
}

/**
 * Ensures an organizer can only manage resources belonging to their own tenant
 */
function enforceTenantScope(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  // Admins can manage any tenant
  if (req.user.role === 'ADMIN') {
    return next();
  }

  // Organizers must have an assigned tenant_id
  if (req.user.role === 'ORGANIZER') {
    if (!req.user.tenantId) {
      return res.status(403).json({
        error: 'Organizer account is not linked to any organization tenant.',
        code: 'NO_TENANT'
      });
    }
    // Attached to req for controller queries
    req.scopedTenantId = req.user.tenantId;
    return next();
  }

  return res.status(403).json({ error: 'Access denied.' });
}

module.exports = {
  requireRole,
  enforceTenantScope
};
