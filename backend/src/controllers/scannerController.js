const db = require('../config/db');
const { success, error } = require('../utils/response');

exports.triggerScan = async (req, res) => {
  try {
    const { scope = 'all', category_id } = req.body;
    const result = await db.query(
      'INSERT INTO stream_scan_jobs (status, total_channels, completed_channels, failed_channels) VALUES ($1, $2, $3, $4) RETURNING *',
      ['running', 0, 0, 0]
    );
    success(res, { jobId: result.rows[0].id, message: 'Scan triggered' });
  } catch (err) {
    error(res, 'Failed to trigger scan', 500);
  }
};

exports.getScanStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM stream_scan_jobs WHERE id = $1', [id]);
    if (result.rows.length === 0) return error(res, 'Job not found', 404);
    success(res, result.rows[0]);
  } catch (err) {
    error(res, 'Failed to fetch scan status', 500);
  }
};

exports.getScanHistory = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM stream_scan_jobs ORDER BY created_at DESC LIMIT 50');
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch scan history', 500);
  }
};
