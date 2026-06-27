const express = require('express');
const router = express.Router();
const { broadcastToClients } = require('../app');
const dashboardController = require('../controllers/dashboardController');

// Get WebSocket connection status
router.get('/status', (req, res) => {
  res.json({ 
    success: true, 
    message: 'WebSocket server is running',
    endpoint: '/ws'
  });
});

// Manually trigger a stats broadcast to all connected clients
// A-1 FIX: Call dashboardController.getDashboardStats instead of duplicating queries
router.post('/broadcast-stats', async (req, res) => {
  try {
    // Create mock response object to reuse getDashboardStats
    let stats = null;
    await dashboardController.getDashboardStats(req, {
      json: (data) => { stats = data; },
      status: () => ({ json: () => {} })
    });

    // Broadcast to all WebSocket clients
    broadcastToClients('stats', stats);

    res.json({ success: true, message: 'Stats broadcast sent to all clients' });
  } catch (err) {
    console.error('Broadcast error:', err);
    res.status(500).json({ success: false, message: 'Failed to broadcast stats' });
  }
});

module.exports = router;