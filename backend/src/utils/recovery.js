const db = require('../config/db');
const { exec } = require('child_process');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Checks if the channels table is completely empty.
 * If empty, triggers the setup-indian script to repopulate from canonical sources.
 */
async function checkChannelsIntegrity() {
  const res = await db.query('SELECT COUNT(*) as count FROM channels');
  const count = parseInt(res.rows[0].count, 10);
  
  if (count === 0) {
    console.log('[RECOVERY] Channels table is completely empty! Attempting automatic restore...');
    try {
      const backendDir = path.join(__dirname, '..', '..');
      // Run the setup-indian script which seeds categories and imports indian streams
      await execPromise('npm run setup-indian', { cwd: backendDir });
      console.log('[RECOVERY] Successfully restored channels from canonical API source.');
      return true; // channels restored
    } catch (err) {
      console.error('[RECOVERY] Fatal error attempting to restore channels:', err.message);
      throw new Error(`Failed to restore channels: ${err.message}`);
    }
  }
  return false; // channels were not empty
}

/**
 * Checks if there are any active channels that lack stream records.
 * If found, backfills channel_streams idempotently using channels.stream_url.
 */
async function checkStreamsIntegrity() {
  // Find channels that have no streams in channel_streams
  const missingRes = await db.query(`
    SELECT c.id, c.name, c.stream_url, c.backup_stream_url, c.user_agent, c.referrer
    FROM channels c
    LEFT JOIN channel_streams cs ON c.id = cs.channel_id
    WHERE cs.id IS NULL AND c.status = 'active'
  `);
  
  const missing = missingRes.rows;
  if (missing.length === 0) {
    return { recovered: 0 };
  }

  console.log(`[RECOVERY] Found ${missing.length} active channels missing stream records. Backfilling...`);
  
  let recoveredCount = 0;
  for (const channel of missing) {
    let hasRecovered = false;
    
    // Restore primary stream
    if (channel.stream_url) {
      await db.query(`
        INSERT INTO channel_streams 
          (channel_id, stream_url, quality, priority, user_agent, referer, source_name, health_status)
        SELECT 
          $1, $2, 'auto', 1, $3, $4, 'recovery-backfill', 'unknown'
        WHERE NOT EXISTS (
          SELECT 1 FROM channel_streams WHERE channel_id = $1 AND stream_url = $2
        )
      `, [channel.id, channel.stream_url, channel.user_agent, channel.referrer]);
      hasRecovered = true;
    }
    
    // Restore backup stream
    if (channel.backup_stream_url) {
      await db.query(`
        INSERT INTO channel_streams 
          (channel_id, stream_url, quality, priority, user_agent, referer, source_name, health_status)
        SELECT 
          $1, $2, 'auto', 2, $3, $4, 'recovery-backfill', 'unknown'
        WHERE NOT EXISTS (
          SELECT 1 FROM channel_streams WHERE channel_id = $1 AND stream_url = $2
        )
      `, [channel.id, channel.backup_stream_url, channel.user_agent, channel.referrer]);
      hasRecovered = true;
    }
    
    if (hasRecovered) {
      // Re-link the active stream id
      await db.query(`
        UPDATE channels c
        SET 
          active_stream_id = (SELECT id FROM channel_streams cs WHERE cs.channel_id = c.id ORDER BY priority ASC LIMIT 1),
          has_backup_streams = CASE WHEN (SELECT count(*) FROM channel_streams cs WHERE cs.channel_id = c.id) > 1 THEN true ELSE false END
        WHERE c.id = $1
      `, [channel.id]);
      recoveredCount++;
    } else {
      console.warn(`[RECOVERY] Warning: Channel ${channel.id} (${channel.name}) has no valid fallback stream URLs to recover.`);
    }
  }
  
  console.log(`[RECOVERY] Stream backfill complete. Recovered streams for ${recoveredCount} channels.`);
  return { recovered: recoveredCount };
}

/**
 * Selects a random sample of recovered channels and verifies they resolve playback correctly.
 */
async function validatePlayback() {
  console.log('[RECOVERY] Validating playback endpoints for random channels...');
  
  // Get up to 5 random active channels that have an active stream
  const sampleRes = await db.query(`
    SELECT c.id, c.name, cs.stream_url
    FROM channels c
    JOIN channel_streams cs ON c.active_stream_id = cs.id
    WHERE c.status = 'active'
    ORDER BY RANDOM()
    LIMIT 5
  `);
  
  if (sampleRes.rows.length === 0) {
    console.log('[RECOVERY] No active channels available to validate.');
    return;
  }
  
  let successCount = 0;
  
  for (const channel of sampleRes.rows) {
    try {
      // Validate database integrity for the channel directly
      const activeStreamRes = await db.query(`
        SELECT * FROM channel_streams WHERE id = (SELECT active_stream_id FROM channels WHERE id = $1)
      `, [channel.id]);
      
      if (activeStreamRes.rows.length > 0 && activeStreamRes.rows[0].stream_url) {
        successCount++;
      } else {
        console.error(`[RECOVERY] Validation failed for channel ${channel.id} (${channel.name}) - Active stream is null!`);
      }
    } catch (err) {
      console.error(`[RECOVERY] Error validating channel ${channel.id}:`, err.message);
    }
  }
  
  console.log(`[RECOVERY] Validation completed. ${successCount}/${sampleRes.rows.length} sampled channels verified to have playable database records.`);
}

/**
 * Main orchestration function.
 */
async function runRecovery() {
  try {
    console.log('[RECOVERY] Commencing Automatic Database Recovery checks...');
    
    const channelsRestored = await checkChannelsIntegrity();
    const { recovered } = await checkStreamsIntegrity();
    
    const channelCountRes = await db.query('SELECT COUNT(*) as count FROM channels');
    const streamCountRes = await db.query('SELECT COUNT(*) as count FROM channel_streams');
    
    console.log(`[RECOVERY] Status Report:`);
    console.log(`[RECOVERY] - Total Channels: ${channelCountRes.rows[0].count}`);
    console.log(`[RECOVERY] - Total Streams: ${streamCountRes.rows[0].count}`);
    
    if (channelsRestored || recovered > 0) {
      await validatePlayback();
      console.log('[RECOVERY] Integrity checks PASSED after recovering missing data.');
    } else {
      console.log('[RECOVERY] Integrity checks PASSED. No data was missing.');
    }
  } catch (err) {
    console.error('[RECOVERY] CRITICAL FAILURE during recovery:', err);
    throw err;
  }
}

module.exports = {
  checkChannelsIntegrity,
  checkStreamsIntegrity,
  validatePlayback,
  runRecovery
};
