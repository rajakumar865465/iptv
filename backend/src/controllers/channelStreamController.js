const db = require('../config/db');
const { success, error } = require('../utils/response');
const { diagnoseStream } = require('../utils/streamDiagnoser');

exports.getChannelStreams = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT * FROM channel_streams WHERE channel_id = $1 ORDER BY priority ASC, created_at DESC',
      [id]
    );
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch channel streams', 500);
  }
};

exports.createChannelStream = async (req, res) => {
  try {
    const {
      channel_id, stream_url, quality, priority, source_name, user_agent, referer,
      final_url, origin, headers_json, codec_video, codec_audio, container_type, segment_type,
      playback_mode, vlc_playable, android_playable
    } = req.body;

    let parsedHeaders = null;
    if (headers_json) {
      try {
        parsedHeaders = typeof headers_json === 'string' ? JSON.parse(headers_json) : headers_json;
      } catch (e) {
        parsedHeaders = null;
      }
    }

    const result = await db.query(
      `INSERT INTO channel_streams (
        channel_id, stream_url, quality, priority, source_name, user_agent, referer,
        final_url, origin, headers_json, codec_video, codec_audio, container_type, segment_type,
        playback_mode, vlc_playable, android_playable
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
      [
        channel_id, stream_url, quality, priority || 1, source_name, user_agent, referer,
        final_url || null, origin || null, parsedHeaders, codec_video || null, codec_audio || null,
        container_type || 'hls', segment_type || 'ts', playback_mode || 'direct',
        vlc_playable !== false, android_playable !== false
      ]
    );
    success(res, result.rows[0], 'Stream added', 201);
  } catch (err) {
    console.error('createChannelStream error:', err.message);
    error(res, 'Failed to add stream', 500);
  }
};

exports.updateChannelStream = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      stream_url, quality, priority, source_name, user_agent, referer,
      final_url, origin, headers_json, codec_video, codec_audio, container_type, segment_type,
      playback_mode, vlc_playable, android_playable, health_status, health_reason
    } = req.body;

    let parsedHeaders = null;
    if (headers_json) {
      try {
        parsedHeaders = typeof headers_json === 'string' ? JSON.parse(headers_json) : headers_json;
      } catch (e) {
        parsedHeaders = null;
      }
    }

    const result = await db.query(
      `UPDATE channel_streams SET 
        stream_url = $1, quality = $2, priority = $3, source_name = $4, user_agent = $5, referer = $6, 
        final_url = $7, origin = $8, headers_json = $9, codec_video = $10, codec_audio = $11, 
        container_type = $12, segment_type = $13, playback_mode = $14, vlc_playable = $15, 
        android_playable = $16, health_status = $17, health_reason = $18, updated_at = NOW() 
      WHERE id = $19 RETURNING *`,
      [
        stream_url, quality, priority, source_name, user_agent, referer,
        final_url, origin, parsedHeaders, codec_video, codec_audio,
        container_type, segment_type, playback_mode, vlc_playable,
        android_playable, health_status, health_reason, id
      ]
    );
    success(res, result.rows[0], 'Stream updated');
  } catch (err) {
    console.error('updateChannelStream error:', err.message);
    error(res, 'Failed to update stream', 500);
  }
};

exports.deleteChannelStream = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM channel_streams WHERE id = $1', [id]);
    success(res, null, 'Stream deleted');
  } catch (err) {
    error(res, 'Failed to delete stream', 500);
  }
};

exports.setPrimaryStream = async (req, res) => {
  try {
    const { channelId, streamId } = req.body;
    const result = await db.query(
      'UPDATE channels SET active_stream_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [streamId, channelId]
    );
    success(res, result.rows[0], 'Primary stream set');
  } catch (err) {
    error(res, 'Failed to set primary stream', 500);
  }
};

exports.diagnoseChannelStream = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the stream detail
    const streamRes = await db.query('SELECT * FROM channel_streams WHERE id = $1', [id]);
    if (streamRes.rows.length === 0) {
      return error(res, 'Stream not found', 404);
    }
    
    const stream = streamRes.rows[0];
    
    // Run diagnostics
    const inputHeaders = {
      'User-Agent': stream.user_agent,
      'Referer': stream.referer,
      'Origin': stream.origin,
      ...(stream.headers_json || {})
    };
    
    console.log(`[diagnose] Starting diagnosis for stream ${id}: ${stream.stream_url}`);
    const report = await diagnoseStream(stream.stream_url, inputHeaders);
    console.log(`[diagnose] Diagnosis finished for stream ${id}: status=${report.health_status}`);
    
    // Update the database with diagnostic results
    const score = report.score !== undefined ? report.score : (report.health_status === 'online' ? 100 : 0);
    const now = new Date();
    
    await db.query(`
      UPDATE channel_streams 
      SET 
        final_url = $1,
        origin = $2,
        codec_video = $3,
        codec_audio = $4,
        container_type = $5,
        segment_type = $6,
        android_playable = $7,
        vlc_playable = $8,
        health_status = $9,
        health_reason = $10,
        health_score = $11,
        last_checked_at = NOW(),
        last_success_at = CASE WHEN $9 = 'online' THEN NOW() ELSE last_success_at END,
        last_failed_at = CASE WHEN $9 = 'offline' THEN NOW() ELSE last_failed_at END,
        success_count = CASE WHEN $9 = 'online' THEN success_count + 1 ELSE success_count END,
        fail_count = CASE WHEN $9 = 'offline' THEN fail_count + 1 ELSE fail_count END,
        updated_at = NOW()
      WHERE id = $12
    `, [
      report.final_url,
      report.headers_detected['Origin'] || report.headers_detected['origin'] || null,
      report.video_codec,
      report.audio_codec,
      report.container_type,
      report.segment_type,
      report.android_playable,
      report.vlc_playable,
      report.health_status,
      report.health_reason,
      score,
      id
    ]);
    
    success(res, report, 'Stream diagnosed successfully');
  } catch (err) {
    console.error('diagnoseChannelStream error:', err);
    error(res, 'Failed to diagnose stream: ' + err.message, 500);
  }
};
