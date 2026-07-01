const db = require('../config/db');
const { success, error } = require('../utils/response');

exports.getDuplicates = async (req, res) => {
  try {
    const result = await db.query(`SELECT c.canonical_name, COALESCE(c.language,'Unknown') AS language, cat.name AS category, COUNT(*) AS count,
      JSON_AGG(JSON_BUILD_OBJECT('id', c.id, 'name', c.name, 'status', c.status, 'health_status', c.health_status, 'quality', c.quality, 'stream_url', c.stream_url) ORDER BY c.id) AS channels
      FROM channels c LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.status NOT IN ('merged','duplicate') AND c.canonical_name IS NOT NULL AND c.canonical_name != ''
      GROUP BY c.canonical_name, COALESCE(c.language,'Unknown'), cat.name
      HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC, c.canonical_name LIMIT 200`);
    success(res, { total_groups: result.rows.length, groups: result.rows });
  } catch (err) {
    error(res, 'Failed to fetch duplicates', 500);
  }
};

exports.mergeDuplicates = async (req, res) => {
  try {
    const { masterId, duplicateIds } = req.body;
    for (const dupId of duplicateIds) {
      // Transfer channel_streams
      await db.query('UPDATE channel_streams SET channel_id = $1 WHERE channel_id = $2', [masterId, dupId]);
      
      // Get dup details
      const dupRes = await db.query('SELECT stream_url, logo_url FROM channels WHERE id = $1', [dupId]);
      if (dupRes.rows.length > 0) {
        const dup = dupRes.rows[0];
        // Copy stream_url/logo_url to master if master doesn't have them
        await db.query(`
          UPDATE channels 
          SET stream_url = COALESCE(NULLIF(stream_url, ''), $1),
              logo_url = COALESCE(NULLIF(logo_url, ''), $2),
              updated_at = NOW()
          WHERE id = $3
        `, [dup.stream_url, dup.logo_url, masterId]);
      }
      
      await db.query("UPDATE channels SET status = 'merged', updated_at = NOW() WHERE id = $1", [dupId]);
    }
    success(res, null, 'Duplicates merged');
  } catch (err) {
    error(res, 'Failed to merge duplicates', 500);
  }
};
