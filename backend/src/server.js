require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const db = require('./config/database');
const { initRedis, isRealRedis } = require('./config/redis');
const { createSchema } = require('./models/schema');
const { seed } = require('./seed');
const { startWorker } = require('./services/workerService');
const { authenticateToken } = require('./middleware/auth');

// Route imports
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const orderRoutes = require('./routes/orderRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const workerRoutes = require('./routes/workerRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS with exposed custom cache headers
app.use(
  cors({
    origin: '*',
    exposedHeaders: ['X-Cache']
  })
);

app.use(morgan('dev'));
app.use(express.json());

// Attach JWT authentication / identity context to every request
app.use(authenticateToken);

// Health & System status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: db.isPostgres() ? 'PostgreSQL' : 'SQLite (sql.js WASM)',
    caching: isRealRedis() ? 'External Redis' : 'In-Memory Redis & Distributed Lock Engine',
    worker: 'Active (10s intervals)'
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/worker', workerRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Global Error Handler]:', err.stack || err.message);
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR'
  });
});

async function startServer() {
  try {
    console.log('------------------------------------------------------------');
    console.log(' Multi-Tenant Event & Ticket Reservation System');
    console.log(' Concurrency Engine with Atomic Transactions & Redis Locks');
    console.log('------------------------------------------------------------');

    // 1. Initialize Database
    await db.initDatabase();
    await createSchema();

    // Check if auto-seed is needed
    const userCount = await db.queryOne('SELECT COUNT(*) as count FROM users');
    if (!userCount || parseInt(userCount.count, 10) === 0) {
      console.log('[Startup] No users found. Running initial database seed...');
      await seed();
    }

    // 2. Initialize Redis / Distributed Lock Engine
    await initRedis();

    // 3. Start Background Hold Cleanup Worker
    startWorker();

    // 4. Start HTTP Server
    app.listen(PORT, () => {
      console.log(`[Server] API backend running on http://localhost:${PORT}`);
      console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('[Fatal Error] Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

module.exports = app;
