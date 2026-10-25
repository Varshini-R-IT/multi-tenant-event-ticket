const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

let db = null;
let SQL = null;
let dbFilePath = null;
let isPostgres = false;
let pgPool = null;

/**
 * Dual-Engine Database Connector
 * - If DATABASE_URL starts with postgres:// or postgresql://, connects via pg
 * - Otherwise, runs portable SQLite via sql.js (WebAssembly) with disk persistence
 */
async function initDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))) {
    console.log('[Database] Connecting to PostgreSQL via DATABASE_URL...');
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    isPostgres = true;
    await pgPool.query('SELECT 1');
    console.log('[Database] PostgreSQL connected successfully.');
    return;
  }

  // SQLite engine via WebAssembly sql.js
  console.log('[Database] Initializing SQLite (sql.js WASM) engine with disk persistence...');
  SQL = await initSqlJs();

  const dataDir = path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  dbFilePath = path.join(dataDir, 'reservations.sqlite');

  if (fs.existsSync(dbFilePath)) {
    const fileBuffer = fs.readFileSync(dbFilePath);
    db = new SQL.Database(fileBuffer);
    console.log(`[Database] Loaded existing SQLite database from ${dbFilePath}`);
  } else {
    db = new SQL.Database();
    console.log(`[Database] Created new SQLite database at ${dbFilePath}`);
    persistSqlite();
  }
}

function persistSqlite() {
  if (db && dbFilePath) {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbFilePath, buffer);
    } catch (err) {
      console.error('[Database] Failed to persist SQLite to disk:', err);
    }
  }
}

/**
 * Execute query and return array of objects
 */
async function query(sql, params = []) {
  if (isPostgres) {
    // Convert ? to $1, $2, etc for PostgreSQL
    let idx = 1;
    const pgSql = sql.replace(/\?/g, () => `$${idx++}`);
    const res = await pgPool.query(pgSql, params);
    return res.rows;
  }

  // sql.js execution
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * Execute a single query returning first row or null
 */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute INSERT, UPDATE, or DELETE query
 */
async function run(sql, params = []) {
  if (isPostgres) {
    let idx = 1;
    let returning = '';
    if (sql.trim().toUpperCase().startsWith('INSERT') && !sql.toUpperCase().includes('RETURNING')) {
      returning = ' RETURNING id';
    }
    const pgSql = sql.replace(/\?/g, () => `$${idx++}`) + returning;
    const res = await pgPool.query(pgSql, params);
    return {
      changes: res.rowCount,
      lastInsertRowid: res.rows && res.rows[0] ? res.rows[0].id : null
    };
  }

  // SQLite execution
  db.run(sql, params);
  persistSqlite();

  // Get last insert rowid and changes
  const lastIdResult = db.exec('SELECT last_insert_rowid() as id');
  const changesResult = db.exec('SELECT changes() as cnt');

  const lastInsertRowid = lastIdResult[0] && lastIdResult[0].values[0] ? lastIdResult[0].values[0][0] : null;
  const changes = changesResult[0] && changesResult[0].values[0] ? changesResult[0].values[0][0] : 0;

  return { changes, lastInsertRowid };
}

/**
 * Execute callback inside an ACID transaction
 */
async function transaction(callback) {
  if (isPostgres) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const txExecutor = {
        query: async (sql, params = []) => {
          let idx = 1;
          const pgSql = sql.replace(/\?/g, () => `$${idx++}`);
          const res = await client.query(pgSql, params);
          return res.rows;
        },
        queryOne: async (sql, params = []) => {
          let idx = 1;
          const pgSql = sql.replace(/\?/g, () => `$${idx++}`);
          const res = await client.query(pgSql, params);
          return res.rows[0] || null;
        },
        run: async (sql, params = []) => {
          let idx = 1;
          const pgSql = sql.replace(/\?/g, () => `$${idx++}`);
          const res = await client.query(pgSql, params);
          return { changes: res.rowCount };
        }
      };

      const result = await callback(txExecutor);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // SQLite Transaction with immediate lock
  try {
    db.run('BEGIN TRANSACTION;');
    const txExecutor = {
      query: (sql, params = []) => {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        return Promise.resolve(rows);
      },
      queryOne: async (sql, params = []) => {
        const rows = await txExecutor.query(sql, params);
        return rows[0] || null;
      },
      run: (sql, params = []) => {
        db.run(sql, params);
        const lastIdResult = db.exec('SELECT last_insert_rowid() as id');
        const changesResult = db.exec('SELECT changes() as cnt');
        return Promise.resolve({
          changes: changesResult[0] ? changesResult[0].values[0][0] : 0,
          lastInsertRowid: lastIdResult[0] ? lastIdResult[0].values[0][0] : null
        });
      }
    };

    const result = await callback(txExecutor);
    db.run('COMMIT;');
    persistSqlite();
    return result;
  } catch (err) {
    try {
      db.run('ROLLBACK;');
    } catch (rollbackErr) {
      // rollback error ignored
    }
    throw err;
  }
}

module.exports = {
  initDatabase,
  query,
  queryOne,
  run,
  transaction,
  isPostgres: () => isPostgres,
  persistSqlite
};
