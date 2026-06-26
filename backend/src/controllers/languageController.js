const db = require('../config/db');
const { success, error } = require('../utils/response');

exports.getLanguages = async (req, res) => {
  try {
    const result = await db.query(`SELECT INITCAP(LOWER(TRIM(language))) as name, COUNT(*) as channel_count FROM channels WHERE language IS NOT NULL AND language != '' GROUP BY LOWER(TRIM(language)) ORDER BY COUNT(*) DESC`);
    success(res, result.rows);
  } catch (err) {
    error(res, 'Failed to fetch languages', 500);
  }
};
