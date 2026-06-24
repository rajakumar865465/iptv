const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const errorHandler = require('./middleware/errorHandler');
const { standardLimiter } = require('./middleware/rateLimit');
const db = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const appConfigRoutes = require('./routes/appConfig');
const licenseRoutes = require('./routes/license');
const channelRoutes = require('./routes/channels');
const userRoutes = require('./routes/users');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const channelController = require('./controllers/channelController');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
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

    // Check if users table exists
    const checkResult = await db.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')"
    );
    if (!checkResult.rows[0].exists) {
      console.log('Database tables not found, running initialization...');
      const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '001_initial_schema.sql'), 'utf8');
      await db.query(sql);
      console.log('Database initialized successfully');
    } else {
      console.log('Database tables already exist');
    }

    // Run additional migration files in order
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir).sort();
    for (const file of files) {
      if (file <= '001_initial_schema.sql') continue;
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      try {
        await db.query(sql);
        console.log(`Migration applied: ${file}`);
      } catch (migErr) {
        console.error(`Migration error in ${file}:`, migErr.message);
      }
    }
  } catch (err) {
    console.error('Database initialization error:', err.message);
  }
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/app', appConfigRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/user', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/internal', adminRoutes);

// Direct alias for categories
app.get('/api/categories', standardLimiter, channelController.getCategories);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Start server after DB init
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

module.exports = app;
