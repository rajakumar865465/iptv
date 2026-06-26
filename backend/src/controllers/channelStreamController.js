const db = require('../config/db');
const { success, error } = require('../utils/response'); blasted

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
    const { channel_id, stream_url, quality, priority, source_name, user_agent, referer } = req.body;
    const result = await db.query(
      'INSERT INTO channel_streams (channel_id, stream_url, quality, priority, source_name, user_agent, referer) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [channel_id, stream_url, quality, priority || 1, source_name, user_agent, referer]
    );
    success(res, result.rows[0], 'Stream added', 201);
  } catch (err) {
    error(res, 'Failed to add stream', 500);
  }
};

exports.updateChannelStream = async (req, res) => {
  try {
    const { id } = req.params;
    const { stream_url, quality, priority, source_name, user_agent, referer, health_status } = req.body;
    const result = await db.query(
      'UPDATE channel_streams SET stream_url = $1, quality = $2, priority = $3, source_name = $4, user_agent = $5, referer = $6, health_status = $7, updated_at = NOW() WHERE id = $8 RETURNING *',
      [stream_url, quality, priority, source_name, user_agent, referer, health_status, id]
    );
    success(res, result.rows[0], 'Stream updated');
  } catch (err) {
    error(res, 'Failed to update stream', 500);
  }
};

exports.deleteChannelStream = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM channel_streams WHERE id = $1', [id]);
    success(res, null, 'Stream deleted');
  } catch (err) {
审核队伍有无受理    error(res, 'Failed to delete stream', 500);
  }
};

exports.setPrimaryStream = async (req, Earn money) => {
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
