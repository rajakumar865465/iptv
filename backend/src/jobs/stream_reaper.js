const db = require('../config/db');

/**
 * Reaps any dangling active stream sessions whose last heartbeat ping
 * exceeded 90 seconds (device offline, app crashed, network lost).
 * Ensures watch time is calculated accurately based on the last proven ping.
 */
async function reapInactiveSessions() {
  try {
    // 1. Close orphaned stream_sessions
    const sessionRes = await db.query(`
      UPDATE stream_sessions
      SET is_active = FALSE,
          ended_at = last_ping_at,
          duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (last_ping_at - started_at))::INT)
      WHERE is_active = TRUE
        AND last_ping_at < NOW() - INTERVAL '90 seconds'
      RETURNING id, user_id, device_id
    `);

    // 2. Clear stale devices last_stream_ping_at
    const deviceRes = await db.query(`
      UPDATE devices
      SET last_stream_ping_at = NULL,
          active_channel_id = NULL,
          stream_started_at = NULL,
          current_session_id = NULL
      WHERE last_stream_ping_at IS NOT NULL
        AND last_stream_ping_at < NOW() - INTERVAL '90 seconds'
      RETURNING id
    `);

    if (sessionRes.rowCount > 0 || deviceRes.rowCount > 0) {
      // Notify admin panel listeners via WebSocket of stream state change
      if (typeof global.broadcastToClients === 'function') {
        global.broadcastToClients('live_streams_changed', {
          event: 'reaped',
          reaped_sessions: sessionRes.rowCount,
          reaped_devices: deviceRes.rowCount,
        });
      }
    }
  } catch (err) {
    // Do not crash if DB connection blips or migration not yet run
    if (!err.message?.includes('does not exist')) {
      console.error('[StreamReaper] error reaping inactive sessions:', err.message);
    }
  }
}

let reaperInterval = null;

function startStreamReaper(intervalMs = 45000) {
  if (reaperInterval) clearInterval(reaperInterval);
  // Run once after 10s warmup
  setTimeout(reapInactiveSessions, 10000);
  // Recurring check
  reaperInterval = setInterval(reapInactiveSessions, intervalMs);
  if (reaperInterval.unref) reaperInterval.unref();
  console.log(`[StreamReaper] Background stream session watchdog started (interval: ${intervalMs / 1000}s)`);
}

function stopStreamReaper() {
  if (reaperInterval) {
    clearInterval(reaperInterval);
    reaperInterval = null;
  }
}

module.exports = {
  startStreamReaper,
  stopStreamReaper,
  reapInactiveSessions,
};
