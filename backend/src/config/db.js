const { Pool } = require('pg');
require('dotenv').config();

const isRender = process.env.RENDER === 'true' || process.env.DATABASE_URL;

// Disable SSL for local/development connections — remote EC2/Render URLs need SSL.
const dbUrl = process.env.DATABASE_URL || '';
const isLocalDb = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
const sslDisabled = dbUrl.includes('sslmode=disable');

const poolConfig = dbUrl
  ? {
      connectionString: dbUrl,
      ssl: (isLocalDb || sslDisabled) ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      // DB-02 FIX: Increased to 20 for production load; keep at 10 for dev/free-tier.
      max: parseInt(process.env.DB_POOL_MAX || (isLocalDb ? '10' : '20'), 10),
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'iptv_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
