const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// IPTV Live TV Backend Application

const errorHandler = require('./middleware/errorHandler');
const { standardLimiter } = require('./middleware/rateLimit');
const db = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const appConfigRoutes = require('./routes/appConfig');
const licenseRoutes = require('./routes/license');
const channelRoutes = require('./routes/channels');
const categoryRoutes = require('./routes/categories');
const proxyRoutes = require('./routes/proxy');
const userRoutes = require('./routes/users');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const channelController = require('./controllers/channelController');

const app = express();

// Trust proxy for rate limiters (required for Render/Heroku)
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
// Fix #17: Restrict CORS to known origins. For a mobile app the origin is typically
// null/undefined, so we allow that too. Tighten this for web admin panels.
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: true, // Allow all origins to resolve public IP access issues
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));
app.use(standardLimiter);

// Health check with DB status
app.get('/health', async (req, res) => {
  let dbStatus = 'unknown';
  try {
    const result = await db.query('SELECT NOW()');
    dbStatus = result.rows ? 'connected' : 'error';
  } catch (err) {
    dbStatus = 'error: ' + err.message;
  }
  res.json({ status: 'ok', db: dbStatus, timestamp: new Date().toISOString() });
});

// Initialize database tables on startup
async function initDatabase() {
  try {
    const fs = require('fs');
    const path = require('path');

    console.log('Running database migrations...');

    // Create schema_migrations table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Fix #32: Track 001_initial_schema.sql in migrations table so it only runs once,
    // not on every startup. CREATE TABLE IF NOT EXISTS is idempotent but still slow at scale.
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

      for (const migrationFile of migrationFiles) {
        // Check if migration was already applied
        const check = await db.query(
          'SELECT 1 FROM schema_migrations WHERE migration_name = $1',
          [migrationFile]
        );
        if (check.rows.length > 0) {
          continue; // Already applied, skip
        }

        try {
          const sql = fs.readFileSync(path.join(migrationsDir, migrationFile), 'utf8');
          await db.query(sql);
          await db.query(
            'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
            [migrationFile]
          );
          console.log(`Migration applied: ${migrationFile}`);
        } catch (err) {
          console.error(`Migration failed for ${migrationFile}:`, err.message);
        }
      }
    }

    // Run seed data idempotently
    const seedPath = path.join(__dirname, '..', 'seeds', 'seed.sql');
    if (fs.existsSync(seedPath)) {
      const sql = fs.readFileSync(seedPath, 'utf8');
      await db.query(sql);
      console.log('Seed data applied');
    }
  } catch (err) {
    console.error('Database initialization error:', err.message);
  }
}

// ARCH-05 FIX: Auto-log 4xx/5xx responses to api_error_logs table.
// This middleware runs AFTER the route handler sends a response, capturing status code and
// error details without intercepting normal flow.
const errorLoggerMiddleware = async (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    // Log any error response (4xx or 5xx) to the DB
    if (res.statusCode >= 400) {
      const userId = req.user?.id || null;
      const errorMessage = (body && typeof body === 'object' && body.message) ? body.message : JSON.stringify(body).slice(0, 500);
      const requestBody = req.body && Object.keys(req.body).length > 0
        ? JSON.stringify(req.body).slice(0, 2000)
        : null;

      // Fire-and-forget — don't block the response
      db.query(
        `INSERT INTO api_error_logs (method, path, status_code, error_message, request_body, user_id)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
        [req.method, req.path.slice(0, 255), res.statusCode, errorMessage, requestBody, userId]
      ).catch(() => {}); // silently ignore if table doesn't exist yet
    }
    return originalJson(body);
  };
  next();
};



// Static serving for cached logos — PLAYBACK-06 FIX: add long-lived Cache-Control header
// so Flutter clients don't re-fetch logos on every app launch.
app.use('/logos', express.static(pathc.join(__dirname, '../public/logos'), {
  maxAge: '1d',
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  },
}));

// ARCH-05: Error logging middleware — registers before routes so all 4xx/5xx are captured
app.use(errorLoggerMiddleware);

// API Routes
const streamRoutes = require('./routes/streamRoutes');
app.use('/api/auth', authRoutes);
app.use('/api/app', appConfigRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/categories', categoryRoutes); // Fix #31: Removed duplicate direct alias below
app.use('/api/proxy', proxyRoutes);
app.use('/api/user', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/internal', adminRoutes);
app.use('/api/stream', streamRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Start server after DB init
initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
});

module.exports = app;