const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { WebSocketServer } = require('ws');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// NivaTV Backend Application

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
const publicRoutes = require('./routes/public');
const channelController = require('./controllers/channelController');

const app = express();

// Trust proxy for rate limiters (required for Render/Heroku)
app.set('trust proxy', 1);

// Middleware — helmet with cross-origin policies relaxed so browser frontends on
// different origins (localhost:3000 in dev, or a deployed domain) can reach the API.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
}));
// Restrict CORS to known origins. For mobile apps the origin is typically
// null/undefined, so we allow that too. Tighten in production via CORS_ORIGINS env var.
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : [];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, curl, server-to-server)
    if (!origin) return callback(null, true);
    // Allow all localhost origins for local development debugging against prod
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }
    // If CORS_ORIGINS is not configured, deny all browser origins in production
    if (allowedOrigins.length === 0) {
      if (process.env.NODE_ENV === 'production') {
        return callback(new Error('CORS not configured for production'));
      }
      // Development: allow all
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));
app.use(standardLimiter);

// Health check — never expose raw DB error messages
app.get('/health', async (req, res) => {
  let dbStatus = 'unknown';
  try {
    const result = await db.query('SELECT NOW()');
    dbStatus = result.rows ? 'connected' : 'error';
  } catch (err) {
    dbStatus = 'error'; // never expose err.message — it may contain connection string details
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

    // Run automatic data recovery checks
    const recovery = require('./utils/recovery');
    await recovery.runRecovery();
  } catch (err) {
    console.error('Database initialization error:', err.message);
  }
}

// ARCH-05 FIX: Auto-log 4xx/5xx responses to api_error_logs table.
// Strips sensitive fields before logging to prevent PII/secrets in DB.
const SENSITIVE_FIELDS = new Set(['password', 'password_hash', 'newPassword', 'razorpay_signature', 'token', 'refreshToken', 'otp']);

const sanitizeBody = (body) => {
  if (!body || typeof body !== 'object') return body;
  const clean = { ...body };
  for (const field of SENSITIVE_FIELDS) {
    if (field in clean) clean[field] = '[REDACTED]';
  }
  return clean;
};

const errorLoggerMiddleware = async (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (res.statusCode >= 400) {
      const userId = req.user?.id || null;
      const errorMessage = (body && typeof body === 'object' && body.message) ? body.message : JSON.stringify(body).slice(0, 500);
      const requestBody = req.body && Object.keys(req.body).length > 0
        ? JSON.stringify(sanitizeBody(req.body)).slice(0, 2000)
        : null;

      // Fix #20: Log to stderr as fallback if DB insert fails (e.g. during outages).
      // Previously .catch(() => {}) silently swallowed the failure, making debugging impossible.
      db.query(
        `INSERT INTO api_error_logs (method, path, status_code, error_message, request_body, user_id)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
        [req.method, req.path.slice(0, 255), res.statusCode, errorMessage, requestBody, userId]
      ).catch((err) => console.error('[errorLogger] Failed to log error to DB:', err.message));
    }
    return originalJson(body);
  };
  next();
};



const path = require('path');

// Static serving for cached logos — PLAYBACK-06 FIX: add long-lived Cache-Control header
// so Flutter clients don't re-fetch logos on every app launch.
app.use('/logos', express.static(path.join(__dirname, '../public/logos'), {
  maxAge: '1d',
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  },
}));

// ARCH-05: Error logging middleware — registers before routes so all 4xx/5xx are captured
app.use(errorLoggerMiddleware);

// API Routes
const streamRoutes = require('./routes/streamRoutes');
const homeRoutes = require('./routes/home');
const smoothPlaybackRoutes = require('./routes/smoothPlayback');
app.use('/api/auth', authRoutes);
app.use('/api/app', appConfigRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/home', homeRoutes);       // DTH-style structured home API
app.use('/api/channels', channelRoutes);
app.use('/api/categories', categoryRoutes); // Fix #31: Removed duplicate direct alias below
app.use('/api/proxy', proxyRoutes);
app.use('/api/user', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/internal', adminRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/smooth', smoothPlaybackRoutes);

// WebSocket routes
const websocketRoutes = require('./routes/websocket');
app.use('/api/ws', websocketRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// WebSocket setup for real-time dashboard updates
let wss;

function broadcastToClients(type, data) {
  if (!wss) return;
  const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}

// Make broadcast available globally
global.broadcastToClients = broadcastToClients;

// Export for use in other modules
module.exports = { app, broadcastToClients };

// Start server after DB init
initDatabase().then(() => {
  const server = http.createServer(app);
  
  // Initialize WebSocket server
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    // Require a valid admin token in the query string: ws://host/ws?token=<adminJWT>
    const urlParams = new URLSearchParams(req.url.replace('/ws', '').replace('?', ''));
    const token = urlParams.get('token');

    if (!token) {
      ws.close(4401, 'Authentication required');
      return;
    }

    try {
      const { verifyAdminToken } = require('./utils/jwt');
      verifyAdminToken(token); // throws if invalid
    } catch (e) {
      ws.close(4403, 'Invalid or expired token');
      return;
    }

    console.log('WebSocket admin client connected');

    // Send initial stats on connection
    const dashboardController = require('./controllers/dashboardController');
    dashboardController.getDashboardStats({ user: null }, {
      json: (data) => ws.send(JSON.stringify({ type: 'stats', data, timestamp: new Date().toISOString() }))
    });

    ws.on('close', () => console.log('WebSocket client disconnected'));
    ws.on('error', (err) => console.error('WebSocket error:', err.message));
  });
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} (WebSocket: ws://0.0.0.0:${PORT}/ws)`);
    
    // Start Smooth Playback buffer recorders
    const bufferRecorder = require('./jobs/buffer_recorder');
    bufferRecorder.startAllEnabledRecorders().catch(err =>
      console.error('Buffer recorder startup error:', err)
    );
    // Cleanup old segments every 2 minutes
    setInterval(() => {
      bufferRecorder.cleanupOldSegments().catch(err =>
        console.error('Buffer cleanup error:', err)
      );
    }, 2 * 60 * 1000);

    // Start automated stream health scanner in the background (runs every hour)
    const { runHealthScan } = require('./jobs/stream_scanner');
    setInterval(() => {
      runHealthScan().catch(err => console.error('Scheduled health scan failed:', err));
    }, 60 * 60 * 1000);
    // Optionally trigger a scan a few minutes after startup
    setTimeout(() => {
      runHealthScan().catch(err => console.error('Initial health scan failed:', err));
    }, 5 * 60 * 1000);
  });
});