require('dotenv').config();
const db = require('./src/config/db');
async function run() {
  const r = await db.query(
    `SELECT id, name, logo_url, stream_url, status, source 
     FROM channels 
     WHERE status = 'active' 
     ORDER BY sort_order ASC, id ASC 
     LIMIT 20`
  );
  console.log('=== First 20 active channels ===');
  r.rows.forEach(ch => {
    console.log(`[${ch.id}] ${ch.name}`);
    console.log(`  logo_url: ${ch.logo_url || 'NULL'}`);
    console.log(`  stream_url: ${ch.stream_url ? ch.stream_url.substring(0, 60) + '...' : 'NULL'}`);
    console.log(`  status: ${ch.status} | source: ${ch.source}`);
    console.log('');
  });

  const counts = await db.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN logo_url IS NOT NULL AND logo_url != '' THEN 1 END) as has_logo,
      COUNT(CASE WHEN logo_url IS NULL OR logo_url = '' THEN 1 END) as no_logo,
      COUNT(CASE WHEN logo_url LIKE '%.svg' THEN 1 END) as svg_logos,
      COUNT(CASE WHEN logo_url LIKE '%.png' OR logo_url LIKE '%.jpg' OR logo_url LIKE '%.webp' OR logo_url LIKE '%.jpeg' THEN 1 END) as raster_logos
    FROM channels WHERE status = 'active'
  `);
  console.log('=== Logo stats for active channels ===');
  console.log(JSON.stringify(counts.rows[0], null, 2));
  await db.pool.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
