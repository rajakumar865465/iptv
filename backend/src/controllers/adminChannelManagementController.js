const db = require('../config/db');
const { success, error } = require('../utils/response');
const { logAudit } = require('../utils/auditLogger');
const { runImportJob } = require('../jobs/m3u_import_engine');

// --- HIDE CHANNEL ---
exports.hideChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, admin_note, prevent_reimport } = req.body;
    const adminId = req.user.id;

    // Fetch existing
    const chRes = await db.query('SELECT * FROM channels WHERE id = $1', [id]);
    if (!chRes.rows.length) return error(res, 'Channel not found', 404);
    const channel = chRes.rows[0];

    // Update
    await db.query(
      `UPDATE channels 
       SET is_hidden = true, hidden_reason = $1, admin_note = $2, hidden_at = NOW(), hidden_by_admin_id = $3, updated_at = NOW() 
       WHERE id = $4`,
      [reason, admin_note, adminId, id]
    );

    // Blocklist
    if (prevent_reimport) {
      await db.query(
        `INSERT INTO channel_blocklist (source, source_channel_id, tvg_id, canonical_name, reason, admin_note, admin_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`, // Assuming constraint exists, or just insert
        [channel.source || 'iptv-org', channel.source_channel_id, channel.tvg_id, channel.canonical_name, reason, admin_note, adminId]
      );
    }

    await logAudit({
      admin_id: adminId, action: 'channel_hidden', target_type: 'channel', target_id: id,
      old_value: { is_hidden: false }, new_value: { is_hidden: true }, reason,
      ip_address: req.ip, user_agent: req.get('User-Agent')
    });

    success(res, { message: 'Channel hidden successfully' });
  } catch (err) {
    console.error('Hide error:', err);
    error(res, 'Failed to hide channel', 500);
  }
};

// --- REMOVE CHANNEL ---
exports.removeChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, admin_note, prevent_reimport } = req.body;
    const adminId = req.user.id;

    const chRes = await db.query('SELECT * FROM channels WHERE id = $1', [id]);
    if (!chRes.rows.length) return error(res, 'Channel not found', 404);
    const channel = chRes.rows[0];

    await db.query(
      `UPDATE channels 
       SET is_removed = true, is_active = false, is_visible_app = false, is_visible_website = false, 
           removed_reason = $1, admin_note = $2, removed_at = NOW(), removed_by_admin_id = $3, updated_at = NOW() 
       WHERE id = $4`,
      [reason, admin_note, adminId, id]
    );

    if (prevent_reimport) {
      await db.query(
        `INSERT INTO channel_blocklist (source, source_channel_id, tvg_id, canonical_name, reason, admin_note, admin_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [channel.source || 'iptv-org', channel.source_channel_id, channel.tvg_id, channel.canonical_name, reason, admin_note, adminId]
      );
    }

    await logAudit({
      admin_id: adminId, action: 'channel_removed', target_type: 'channel', target_id: id,
      old_value: { is_removed: false }, new_value: { is_removed: true }, reason,
      ip_address: req.ip, user_agent: req.get('User-Agent')
    });

    success(res, { message: 'Channel removed from public successfully' });
  } catch (err) {
    console.error('Remove error:', err);
    error(res, 'Failed to remove channel', 500);
  }
};

// --- RESTORE CHANNEL ---
exports.restoreChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const { restore_in_app } = req.body;
    const adminId = req.user.id;

    const chRes = await db.query('SELECT * FROM channels WHERE id = $1', [id]);
    if (!chRes.rows.length) return error(res, 'Channel not found', 404);
    
    await db.query(
      `UPDATE channels 
       SET is_hidden = false, is_removed = false, status = 'active', 
           is_visible_app = $1, is_visible_website = $1, updated_at = NOW(),
           hidden_reason = NULL, removed_reason = NULL
       WHERE id = $2`,
      [restore_in_app !== false, id]
    );

    await logAudit({
      admin_id: adminId, action: 'channel_restored', target_type: 'channel', target_id: id,
      new_value: { is_hidden: false, is_removed: false },
      ip_address: req.ip, user_agent: req.get('User-Agent')
    });

    success(res, { message: 'Channel restored successfully' });
  } catch (err) {
    console.error('Restore error:', err);
    error(res, 'Failed to restore channel', 500);
  }
};

// --- RESTORE ALL HIDDEN CHANNELS ---
exports.restoreAllHiddenChannels = async (req, res) => {
  try {
    const adminId = req.user.id;
    
    const result = await db.query(
      `UPDATE channels 
       SET is_hidden = false, is_removed = false, status = 'active', 
           is_visible_app = true, is_visible_website = true, updated_at = NOW(),
           hidden_reason = NULL, removed_reason = NULL
       WHERE is_hidden = true`
    );

    await logAudit({
      admin_id: adminId, action: 'all_hidden_channels_restored', target_type: 'channel', target_id: 'all',
      new_value: { is_hidden: false, is_removed: false, restored_count: result.rowCount },
      ip_address: req.ip, user_agent: req.get('User-Agent')
    });

    success(res, { message: `${result.rowCount} hidden channels restored successfully` });
  } catch (err) {
    console.error('Restore all hidden error:', err);
    error(res, 'Failed to restore all hidden channels', 500);
  }
};

// --- IMPORT IPTV ---
exports.startImportJob = async (req, res) => {
  try {
    const { source_url, options } = req.body;
    const adminId = req.user.id;

    // Create job record
    const jobRes = await db.query(
      `INSERT INTO import_jobs (admin_id, source_url, options) VALUES ($1, $2, $3) RETURNING id`,
      [adminId, source_url || 'https://iptv-org.github.io/iptv/index.m3u', JSON.stringify(options || {})]
    );
    const jobId = jobRes.rows[0].id;

    // Trigger background process (fire and forget)
    runImportJob(jobId).catch(err => console.error("Import job failed:", err));

    await logAudit({
      admin_id: adminId, action: 'import_started', target_type: 'import_job', target_id: jobId,
      new_value: { source_url, options }, ip_address: req.ip, user_agent: req.get('User-Agent')
    });

    success(res, { message: 'Import job started', job_id: jobId });
  } catch (err) {
    console.error('Start import error:', err);
    error(res, 'Failed to start import job', 500);
  }
};

// --- GET IMPORT JOBS ---
exports.getImportJobs = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT 20');
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch import jobs', 500);
  }
};

// --- GET HIDDEN CHANNELS ---
exports.getHiddenChannels = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT c.*, cat.name as category_name 
      FROM channels c LEFT JOIN categories cat ON c.category_id = cat.id 
      WHERE c.is_hidden = true ORDER BY c.hidden_at DESC
    `);
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch hidden channels', 500);
  }
};

// --- GET REMOVED CHANNELS ---
exports.getRemovedChannels = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT c.*, cat.name as category_name 
      FROM channels c LEFT JOIN categories cat ON c.category_id = cat.id 
      WHERE c.is_removed = true ORDER BY c.removed_at DESC
    `);
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch removed channels', 500);
  }
};
