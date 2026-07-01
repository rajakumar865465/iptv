const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

function getBaseName(name) {
    if (!name) return '';
    // Remove resolution/quality tags
    let clean = name.replace(/\(\d+p\)/gi, '')
                    .replace(/\b(HD|SD|FHD|4K)\b/gi, '');
    // Lowercase and remove all non-alphanumeric
    return clean.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function main() {
    try {
        const recoveredContent = fs.readFileSync('../recovered_channels.txt', 'utf8');
        const blocks = recoveredContent.split(/\r?\n\r?\n/);
        
        const recoveredChannels = [];
        for (const block of blocks) {
            const lines = block.split(/\r?\n/);
            if (lines.length >= 2) {
                recoveredChannels.push({ name: lines[0].trim(), url: lines[1].trim() });
            }
        }
        
        console.log(`Loaded ${recoveredChannels.length} recovered channels to process.`);

        const poolConfig = process.env.DATABASE_URL
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            }
        : {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'iptv_db',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
            };
            
        const pool = new Pool(poolConfig);
        
        // Fetch all DB channels
        const dbRes = await pool.query('SELECT id, name FROM channels');
        const dbChannels = dbRes.rows;
        console.log(`Loaded ${dbChannels.length} channels from DB.`);
        
        let updatedCount = 0;
        
        for (const r of recoveredChannels) {
            const rBase = getBaseName(r.name);
            
            // Find matches in DB
            const matches = dbChannels.filter(dbC => getBaseName(dbC.name) === rBase);
            
            for (const match of matches) {
                const query = `
                    UPDATE channels 
                    SET backup_stream_url = stream_url, 
                        stream_url = $1, 
                        status = 'active',
                        updated_at = NOW()
                    WHERE id = $2
                `;
                await pool.query(query, [r.url, match.id]);
                updatedCount++;
                console.log(`✅ Updated DB Channel: "${match.name}" with stream for "${r.name}"`);
            }
        }
        
        await pool.end();
        console.log(`\nSuccessfully updated ${updatedCount} rows in the database using loose matching!`);
        
    } catch (e) {
        console.error('Error during update:', e);
    }
}

main();
