const db = require('../config/db');

/**
 * Logs an administrative action to the database.
 * 
 * @param {Object} options
 * @param {number|null} options.admin_id - ID of the admin performing the action
 * @param {string} options.action - Short string describing the action (e.g. 'channel_hidden')
 * @param {string} options.target_type - What was affected (e.g. 'channel', 'stream')
 * @param {number|string|null} options.target_id - ID of the affected resource
 * @param {Object|null} options.old_value - JSON representation of the old state
 * @param {Object|null} options.new_value - JSON representation of the new state
 * @param {string|null} options.reason - Reason provided by admin
 * @param {string|null} options.ip_address - Admin IP address
 * @param {string|null} options.user_agent - Admin user agent
 * @param {Object|null} options.client - Optional pg client. Pass the caller's
 *        transaction client when the log must commit or roll back together with
 *        the change it describes (e.g. approving a payment). Omit for pool use.
 */
const logAudit = async ({
  admin_id,
  action,
  target_type,
  target_id = null,
  old_value = null,
  new_value = null,
  reason = null,
  ip_address = null,
  user_agent = null,
  client = null
}) => {
  try {
    const details = {
      old_value,
      new_value,
      reason
    };

    const query = `
      INSERT INTO admin_audit_logs 
        (admin_id, action, target_type, target_id, details, ip_address, user_agent)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7)
    `;
    
    const values = [
      admin_id,
      action,
      target_type,
      target_id,
      JSON.stringify(details),
      ip_address,
      user_agent
    ];

    await (client || db).query(query, values);
  } catch (err) {
    console.error('Failed to write audit log:', err);
    // Fire-and-forget by default: a logging failure shouldn't break the caller.
    // But when a transaction client was passed in, the caller asked for the log
    // and the change to be atomic — and a failed INSERT has already poisoned that
    // transaction — so surface it instead of letting COMMIT fail confusingly.
    if (client) throw err;
  }
};

module.exports = {
  logAudit
};
