require('dotenv').config();
const db = require('../src/config/db');

async function main() {
  console.log('[Backfill] Starting country backfill...');
  try {
    const res = await db.query('SELECT id, tvg_id, country FROM channels WHERE country IS NULL OR country = \'\'');
    const channels = res.rows;
    console.log(`[Backfill] Found ${channels.length} channels with no country.`);

    let updatedCount = 0;
    for (const c of channels) {
      let extractedCountry = 'INTL';
      if (c.tvg_id) {
        const parts = c.tvg_id.split('.');
        if (parts.length > 1) {
          extractedCountry = parts[parts.length - 1].toUpperCase();
        }
      }
      
      const isVisibleApp = (extractedCountry === 'IN' || extractedCountry === 'INTL_IN');

      await db.query(`
        UPDATE channels 
        SET country = $1, is_visible_app = $2
        WHERE id = $3
      `, [extractedCountry, isVisibleApp, c.id]);
      updatedCount++;
    }
    
    // Final enforcement to hide any remaining non-Indian channels that might already have a country code
    await db.query(`
      UPDATE channels 
      SET is_visible_app = false
      WHERE country NOT IN ('IN', 'INTL_IN') AND is_visible_app = true
    `);
    
    console.log(`[Backfill] Successfully updated ${updatedCount} untagged channels.`);
    console.log(`[Backfill] All international channels are now hidden by default.`);
  } catch (err) {
    console.error('[Backfill] Error:', err);
  } finally {
    process.exit(0);
  }
}

main();
