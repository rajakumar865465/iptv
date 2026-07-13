const express = require('express');
const router = express.Router();
// Use the global broadcast function set in app.js to avoid a circular dependency
// (websocket.js is required by app.js, so importing app.js here creates a cycle)
const dashboardController = require('../controllers/dashboardController');
const adminAuthMiddleware = require('../middleware/adminAuth');

// Get WebSocket connection status (public — no sensitive data)
router.get('/status', (req, res) => {
  res.json({
    success: true,
    message: 'WebSocket server is running',
    endpoint: '/ws'
  });
});

// Manually trigger a stats broadcast — admin auth required
router.post('/broadcast-stats', adminAuthMiddleware, async (req, res) => {
  try {
    let stats = null;
    await dashboardController.getDashboardStats(req, {
      json: (data) => { stats = data; },
      status: () => ({ json: () => {} })
    });

    global.broadcastToClients?.('stats', stats);

    res.json({ success: true, message: 'Stats broadcast sent to all clients' });
  } catch (err) {
    console.error('Broadcast error:', err);
    res.status(500).json({ success: false, message: 'Failed to broadcast stats' });
  }
});

module.exports = router;
