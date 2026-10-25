const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_jwt_key_2026_super_secure';

/**
 * Middleware to authenticate requests using JWT Bearer token or quick demo x-user-id
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  // Support header override for quick UI role-switch testing (e.g. x-user-id)
  const quickUserId = req.headers['x-user-id'];

  if (quickUserId && !token) {
    try {
      const user = await db.queryOne('SELECT id, email, name, role, tenant_id FROM users WHERE id = ?', [quickUserId]);
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenant_id
        };
        return next();
      }
    } catch (err) {
      console.warn('[Auth] Quick user lookup failed:', err.message);
    }
  }

  if (!token) {
    // Optional public route continuation (req.user remains undefined)
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Invalid or expired authorization token.',
      code: 'TOKEN_INVALID'
    });
  }
}

/**
 * Strict authentication guard
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required to access this resource.',
      code: 'UNAUTHORIZED'
    });
  }
  next();
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenant_id || user.tenantId
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = {
  authenticateToken,
  requireAuth,
  generateToken,
  JWT_SECRET
};
