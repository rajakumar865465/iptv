const db = require('../config/db');
const StreamScanner = require('../utils/StreamScanner');
const os = require('os');

const BATCH_SIZE = 4; // Number of streams to diagnose concurrently
const SCAN_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
// Require this many consecutive scan failures before marking a stream offline.
// A single transient CDN hiccup should not evict a working stream.
const OFFLINE_FAILURE_THRESHOLD = 3;

async function runHealthScan() {
  console.log(`[StreamScanner] Starting health scan at ${new Date().toISOString()}`);

  try {
    // Get all active streams for channels that are NOT removed and NOT hidden
    // We prioritize streams that haven't been checked recently or are currently unstable/offline
    // Bug fix: is_active column does not exist in channel_streams; use is_hidden instead.
    // Also guard against NULL booleans with IS NOT TRUE / IS NOT FALSE pattern.
    const { rows: streams } = await db.query(`
      SELECT cs.id, cs.stream_url, cs.headers_json, cs.user_agent, cs.referer, cs.channel_id,
             cs.health_status, COALESCE(cs.consecutive_scan_failures, 0) AS consecutive_scan_failures,
             c.is_paid, c.is_premium
      FROM channel_streams cs
      JOIN channels c ON cs.channel_id = c.id
      WHERE cs.is_hidden IS NOT TRUE
        AND c.is_removed IS NOT TRUE
        AND c.is_visible_app IS NOT FALSE
      ORDER BY
        CASE
          WHEN cs.health_status = 'unknown' THEN 1
          WHEN cs.health_status = 'unstable' THEN 2
          WHEN cs.health_status = 'offline' THEN 3
          ELSE 4
        END,
        cs.updated_at ASC
    `);

    const streamsToScan = [];
    for (const stream of streams) {
      const failures = stream.consecutive_scan_failures;
      if (failures >= 46) {
        // Mark offline and requires manual verification permanently until admin resets
        await db.query(`
          UPDATE channel_streams
          SET health_status = 'offline', health_reason = 'requires_manual_verification', updated_at = NOW()
          WHERE id = $1
        `, [stream.id]);
        continue;
      }
      
      const updatedAtMs = new Date(stream.updated_at).getTime();
      const nowMs = Date.now();
      
      if (failures >= 30) {
        const sixHoursMs = 6 * 60 * 60 * 1000;
        if (nowMs - updatedAtMs < sixHoursMs) continue; // Skip scan for 6 hours
      } else if (failures >= 10) {
        const thirtyMinsMs = 30 * 60 * 1000;
        if (nowMs - updatedAtMs < thirtyMinsMs) continue; // Skip scan for 30 mins
      }
      
      streamsToScan.push(stream);
    }

    console.log(`[StreamScanner] Found ${streamsToScan.length} streams to scan after filtering out cooldowns.`);

    for (let i = 0; i < streamsToScan.length; i += BATCH_SIZE) {
      // Dynamic throttling based on CPU load
      const cpus = os.cpus().length;
      const load1m = os.loadavg()[0];
      const loadPercentage = load1m / cpus;
      
      let delayMs = 2000;
      if (loadPercentage > 0.8) {
        console.log(`[StreamScanner] High CPU load detected (${(loadPercentage * 100).toFixed(0)}%). Throttling scanner...`);
        delayMs = 10000; // 10 seconds between batches if CPU is > 80%
      } else if (loadPercentage > 0.6) {
        delayMs = 5000; // 5 seconds if CPU is > 60%
      }

      const batch = streamsToScan.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (stream) => {
        try {
          let headers = {};
          if (stream.headers_json) {
            try {
              headers = typeof stream.headers_json === 'string' 
                ? JSON.parse(stream.headers_json) 
                : stream.headers_json;
            } catch (e) {
              console.warn(`[StreamScanner] Invalid headers for stream ${stream.id}`);
            }
          }
          if (stream.user_agent && !headers['User-Agent']) headers['User-Agent'] = stream.user_agent;
          if (stream.referer && !headers['Referer']) headers['Referer'] = stream.referer;

          const result = await StreamScanner.deepScan(stream.stream_url, headers);
          const scanWorking = result.scanner_status === 'working';

          // Consecutive failure tracking: only flip to offline after OFFLINE_FAILURE_THRESHOLD
          // consecutive bad scans so a single transient CDN hiccup does not evict working streams.
          const newConsecutiveFailures = scanWorking ? 0 : stream.consecutive_scan_failures + 1;
          let resolvedHealthStatus;
          if (scanWorking) {
            resolvedHealthStatus = 'online';
          } else if (newConsecutiveFailures >= OFFLINE_FAILURE_THRESHOLD) {
            if (result.scanner_status === 'forbidden' && (stream.is_paid || stream.is_premium)) {
              resolvedHealthStatus = 'paid_blocked_scan';
            } else {
              resolvedHealthStatus = result.scanner_status; // e.g. 'offline', 'geo_blocked', etc.
            }
          } else {
            // Keep current status during the grace window; show 'unstable' if currently online
            resolvedHealthStatus = stream.health_status === 'online' ? 'unstable' : stream.health_status;
          }

          // Update channel_streams table with deep scan results
          await db.query(`
            UPDATE channel_streams
            SET
              health_status = $1,
              health_reason = $2,
              consecutive_scan_failures = $3,
              master_m3u8_load_success = $4,
              media_playlist_load_success = $5,
              playlist_refresh_success = $6,
              segment_load_success_1 = $7,
              segment_load_success_2 = $8,
              segment_load_success_3 = $9,
              segment_response_time = $10,
              segment_content_type = $11,
              segment_size = $12,
              redirects_followed = $13,
              final_url = $14,
              required_headers = $15,
              http_error_code = $16,
              token_expiry_detected = $17,
              html_error_page_detected = $18,
              geo_blocked = $19,
              drm_protected = $20,
              codec_issue_detected = $21,
              scanner_status = $22,
              updated_at = NOW()
            WHERE id = $23
          `, [
            resolvedHealthStatus,
            scanWorking ? 'stable' : `failed_${result.scanner_status}`,
            newConsecutiveFailures,
            result.master_m3u8_load_success,
            result.media_playlist_load_success,
            result.playlist_refresh_success,
            result.segment_load_success_1,
            result.segment_load_success_2,
            result.segment_load_success_3,
            result.segment_response_time,
            result.segment_content_type,
            result.segment_size,
            result.redirects_followed,
            result.final_url,
            JSON.stringify(result.required_headers),
            result.http_error_code,
            result.token_expiry_detected,
            result.html_error_page_detected,
            result.geo_blocked,
            result.drm_protected,
            result.codec_issue_detected,
            result.scanner_status,
            stream.id
          ]);

          console.log(`[StreamScanner] Stream ${stream.id} (${stream.stream_url.substring(0, 30)}...) -> ${resolvedHealthStatus} (consecutive_failures=${newConsecutiveFailures})`);
        } catch (err) {
          // Scanner crash: increment failure count but do NOT immediately mark offline —
          // the stream may be perfectly fine and the crash was a timeout/network issue on our side.
          console.error(`[StreamScanner] Error scanning stream ${stream.id}:`, err.message);
          const newFailures = stream.consecutive_scan_failures + 1;
          const crashStatus = newFailures >= OFFLINE_FAILURE_THRESHOLD ? 'offline' : stream.health_status;
          await db.query(`
            UPDATE channel_streams
            SET health_status = $1,
                health_reason = 'scanner_crash',
                consecutive_scan_failures = $2,
                updated_at = NOW()
            WHERE id = $3
          `, [crashStatus, newFailures, stream.id]);
        }
      }));

      // Delay between batches based on CPU load calculated above
      await new Promise(r => setTimeout(r, delayMs));
    }
    
    // After scanning, update only the channels whose streams were actually scanned.
    // Updating all channels would overwrite user-playback-reported health with stale
    // stream data for channels that weren't touched this cycle.
    const scannedChannelIds = [...new Set(streamsToScan.map(s => s.channel_id))];
    await updateParentChannelHealth(scannedChannelIds);

    console.log(`[StreamScanner] Health scan completed at ${new Date().toISOString()}`);
  } catch (err) {
    console.error('[StreamScanner] Fatal error during scan:', err);
  }
}

async function updateParentChannelHealth(channelIds) {
  if (!channelIds || channelIds.length === 0) return;

  console.log(`[StreamScanner] Updating parent channels aggregate health for ${channelIds.length} channel(s)...`);

  for (const channelId of channelIds) {
    await db.query(`
      WITH best_stream AS (
        SELECT health_status, health_score
        FROM channel_streams
        WHERE channel_id = $1
          AND is_hidden IS NOT TRUE
        ORDER BY
          CASE health_status
            WHEN 'online'   THEN 1
            WHEN 'unstable' THEN 2
            WHEN 'offline'  THEN 3
            ELSE 4
          END,
          priority ASC
        LIMIT 1
      )
      UPDATE channels
      SET health_status   = COALESCE((SELECT health_status FROM best_stream), 'unknown'),
          health_score    = COALESCE((SELECT health_score  FROM best_stream), 0),
          last_checked_at = NOW(),
          needs_manual_verification = CASE WHEN (SELECT health_status FROM best_stream) = 'paid_blocked_scan' THEN true ELSE needs_manual_verification END
      WHERE id = $1
    `, [channelId]);
  }

  console.log('[StreamScanner] Parent channel health updated.');
}

// If run directly from CLI
if (require.main === module) {
  runHealthScan().then(() => {
    console.log('[StreamScanner] Process exiting.');
    process.exit(0);
  });
}

module.exports = { runHealthScan };
