const db = require('../config/db');
const os = require('os');
const { success, error } = require('../utils/response');

exports.getSystemHealth = async (req, res) => {
  try {
    const dbResult = await db.query('SELECT NOW()');
    const dbHealthy = dbResult.rows.length > 0;
    const memoryUsage = process.memoryUsage();
    success(res, {
      db: { status: dbHealthy ? 'connected' : 'error', timestamp: dbResult.rows[0].now },
      server: { uptime: process.uptime(), memory: { rss: memoryUsage.rss, heapUsed: memoryUsage.heapUsed, heapTotal: memoryUsage.heapTotal } },
      os: { platform: os.platform(), arch: os.arch(), totalMemory: os.totalmem(), freeMemory: os.freemem() },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    error(res, 'Failed to fetch system health', 500);
  }
};
