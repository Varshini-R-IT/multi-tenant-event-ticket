const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { generateToken } = require('../middleware/auth');

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await db.queryOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Fetch tenant details if organizer
    let tenant = null;
    if (user.tenant_id) {
      tenant = await db.queryOne('SELECT id, name, slug FROM tenants WHERE id = ?', [user.tenant_id]);
    }

    const token = generateToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenant_id,
        tenant
      }
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
}

async function register(req, res) {
  try {
    const { email, password, name, role = 'ATTENDEE', organizationName } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required.' });
    }

    const existing = await db.queryOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `usr_${uuidv4().substring(0, 12)}`;
    let tenantId = null;

    // If registering as ORGANIZER, create an Organization Tenant
    if (role === 'ORGANIZER') {
      const orgName = organizationName || `${name}'s Organization`;
      tenantId = `ten_${uuidv4().substring(0, 10)}`;
      const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      await db.run(
        `INSERT INTO tenants (id, name, slug, description, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [tenantId, orgName, slug, `Tenant account for ${orgName}`, new Date().toISOString()]
      );
    }

    await db.run(
      `INSERT INTO users (id, tenant_id, email, password_hash, name, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, tenantId, email.toLowerCase().trim(), passwordHash, name, role, new Date().toISOString()]
    );

    const newUser = { id: userId, email, name, role, tenant_id: tenantId };
    const token = generateToken(newUser);

    return res.status(201).json({
      token,
      user: {
        id: userId,
        email,
        name,
        role,
        tenantId
      }
    });
  } catch (err) {
    console.error('[Auth] Registration error:', err);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
}

async function me(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    const user = await db.queryOne('SELECT id, email, name, role, tenant_id FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    let tenant = null;
    if (user.tenant_id) {
      tenant = await db.queryOne('SELECT id, name, slug, description FROM tenants WHERE id = ?', [user.tenant_id]);
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenant_id,
        tenant
      }
    });
  } catch (err) {
    console.error('[Auth] me error:', err);
    return res.status(500).json({ error: 'Failed to fetch current user profile.' });
  }
}

/**
 * Returns pre-seeded demo accounts with pre-signed tokens for 1-click role switching in UI
 */
async function getDemoAccounts(req, res) {
  try {
    const demoUsers = await db.query(`
      SELECT u.id, u.email, u.name, u.role, u.tenant_id, t.name as tenant_name
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      ORDER BY
        CASE u.role
          WHEN 'ADMIN' THEN 1
          WHEN 'ORGANIZER' THEN 2
          ELSE 3
        END, u.name ASC
    `);

    const accountsWithTokens = demoUsers.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      tenantId: u.tenant_id,
      tenantName: u.tenant_name,
      token: generateToken(u)
    }));

    return res.json({ accounts: accountsWithTokens });
  } catch (err) {
    console.error('[Auth] getDemoAccounts error:', err);
    return res.status(500).json({ error: 'Failed to fetch demo accounts.' });
  }
}

module.exports = {
  login,
  register,
  me,
  getDemoAccounts
};
