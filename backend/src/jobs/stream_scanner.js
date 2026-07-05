const db = require('../config/db');
const StreamScanner = require('../utils/StreamScanner');

const BATCH_SIZE = 10; // Number of streams to diagnose concurrently
const SCAN_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function runHealthScan() {
  console.log(`[StreamScanner] Starting health scan at ${new Date().toISOString()}`);

  try {
    // Get all active streams for channels that are NOT removed and NOT hidden
    // We prioritize streams that haven't been checked recently or are currently unstable/offline
    // Bug fix: is_active column does not exist in channel_streams; use is_hidden instead.
    // Also guard against NULL booleans with IS NOT TRUE / IS NOT FALSE pattern.
    const { rows: streams } = await db.query(`
      SELECT cs.id, cs.stream_url, cs.headers_json, cs.channel_id
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

    console.log(`[StreamScanner] Found ${streams.length} active streams to scan.`);

    for (let i = 0; i < streams.length; i += BATCH_SIZE) {
      const batch = streams.slice(i, i + BATCH_SIZE);
      
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

          const result = await StreamScanner.deepScan(stream.stream_url, headers);

          // Update channel_streams table with deep scan results
          await db.query(`
            UPDATE channel_streams
            SET
              health_status = $1,
              health_reason = $2,
              master_m3u8_load_success = $3,
              media_playlist_load_success = $4,
              playlist_refresh_success = $5,
              segment_load_success_1 = $6,
              segment_load_success_2 = $7,
              segment_load_success_3 = $8,
              segment_response_time = $9,
              segment_content_type = $10,
              segment_size = $11,
              redirects_followed = $12,
              final_url = $13,
              required_headers = $14,
              http_error_code = $15,
              token_expiry_detected = $16,
              html_error_page_detected = $17,
              geo_blocked = $18,
              drm_protected = $19,
              codec_issue_detected = $20,
              scanner_status = $21,
              updated_at = NOW()
            WHERE id = $22
          `, [
            result.scanner_status,
            result.scanner_status === 'working' ? 'stable' : `failed_${result.scanner_status}`,
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
          
          console.log(`[StreamScanner] Stream ${stream.id} (${stream.stream_url.substring(0, 30)}...) -> ${result.health_status}`);
        } catch (err) {
          console.error(`[StreamScanner] Error scanning stream ${stream.id}:`, err.message);
          await db.query(`
            UPDATE channel_streams 
            SET health_status = 'offline', health_reason = 'scanner_crash', updated_at = NOW()
            WHERE id = $1
          `, [stream.id]);
        }
      }));

      // Small delay between batches to avoid overloading the network/CPU
      await new Promise(r => setTimeout(r, 2000));
    }
    
    // After scanning streams, we need to update the parent channel's health status
    // based on the best health status of its active streams.
    await updateParentChannelHealth();

    console.log(`[StreamScanner] Health scan completed at ${new Date().toISOString()}`);
  } catch (err) {
    console.error('[StreamScanner] Fatal error during scan:', err);
  }
}

async function updateParentChannelHealth() {
  console.log('[StreamScanner] Updating parent channels aggregate health...');
  
  const { rows: channels } = await db.query(`
    SELECT id FROM channels WHERE is_removed IS NOT TRUE
  `);

  for (const c of channels) {
    // Bug fix: was setting channels.status = health_status (e.g. 'online', 'offline'),
    // but channels.status must remain 'active'/'inactive' for getChannels WHERE c.status='active'.
    // Now correctly updates health_status and health_score only, never touches status.
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
      SET health_status  = COALESCE((SELECT health_status  FROM best_stream), 'unknown'),
          health_score   = COALESCE((SELECT health_score   FROM best_stream), 0),
          last_checked_at = NOW(),
          is_hidden = CASE 
             WHEN COALESCE((SELECT health_status FROM best_stream), 'unknown') = 'offline' THEN true
             WHEN COALESCE((SELECT health_status FROM best_stream), 'unknown') IN ('online', 'unstable') THEN false
             ELSE is_hidden
          END
      WHERE id = $1
    `, [c.id]);
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
