const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' }); // adjusted for scripts folder

async function main() {
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'iptv_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        ssl: false
    });

    try {
        console.log('Connecting to database...');
        
        // Read JSON
        const raw = fs.readFileSync('../../channels_prod.json', 'utf8');
        const json = JSON.parse(raw);
        const channels = json.data;

        if (!Array.isArray(channels)) {
            throw new Error('Expected data to be an array');
        }

        console.log(`Found ${channels.length} channels in JSON.`);

        let inserted = 0;
        for (const c of channels) {
            try {
                // Ensure category 1 exists for fallback
                await pool.query(`INSERT INTO categories (id, name, slug) VALUES (1, 'News', 'news') ON CONFLICT (id) DO NOTHING;`);
                if (c.category_id) {
                     await pool.query(`INSERT INTO categories (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING;`, [c.category_id, c.category_name || 'Category ' + c.category_id, 'cat-' + c.category_id]);
                }

                await pool.query(`
                    INSERT INTO channels (name, logo_url, stream_url, backup_stream_url, category_id, language, quality, status)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [c.name, c.logo_url, c.stream_url, c.backup_stream_url, c.category_id || 1, c.language || 'Unknown', c.quality || 'Auto', c.status || 'active']);
                inserted++;
            } catch (err) {
                console.error(`Error inserting ${c.name}:`, err.message);
            }
        }
        
        console.log(`✅ Successfully inserted ${inserted} channels.`);
        
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

main();
