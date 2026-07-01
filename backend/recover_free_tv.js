const https = require('https');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

function getBaseName(name) {
    if (!name) return '';
    let clean = name.replace(/\(\d+p\)/gi, '').replace(/\b(HD|SD|FHD|4K)\b/gi, '');
    return clean.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function fetchFreeTvM3u() {
    return new Promise((resolve, reject) => {
        const url = 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8';
        console.log(`Fetching ${url}...`);
        
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                return reject(new Error(`Failed to fetch Free-TV M3U: ${res.statusCode}`));
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

function parseM3u(m3uContent) {
    const lines = m3uContent.split(/\r?\n/);
    const channels = new Map();
    let currentName = '';
    
    for (const line of lines) {
        if (line.startsWith('#EXTINF')) {
            const parts = line.split(',');
            currentName = parts.length > 1 ? parts[1].trim() : '';
        } else if (line.trim() && !line.startsWith('#') && currentName) {
            const cName = getBaseName(currentName);
            if (cName && !channels.has(cName)) {
                channels.set(cName, { originalName: currentName, url: line.trim() });
            }
        }
    }
    return channels;
}

async function main() {
    try {
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
        
        // 1. Fetch DB channels that are still broken
        // We know we just fixed 320, so let's try to match ALL channels just in case
        console.log('Fetching channels from database...');
        const dbRes = await pool.query("SELECT id, name FROM channels");
        const dbChannels = dbRes.rows;
        
        // 2. Fetch Free-TV list
        const m3uContent = await fetchFreeTvM3u();
        const freeTvChannels = parseM3u(m3uContent);
        console.log(`Loaded ${freeTvChannels.size} channels from Free-TV.`);
        
        let updatedCount = 0;
        
        // 3. Match and Update
        for (const dbC of dbChannels) {
            const dbBase = getBaseName(dbC.name);
            
            if (freeTvChannels.has(dbBase)) {
                const match = freeTvChannels.get(dbBase);
                const query = `
                    UPDATE channels 
                    SET backup_stream_url = stream_url, 
                        stream_url = $1, 
                        status = 'active',
                        updated_at = NOW()
                    WHERE id = $2
                `;
                await pool.query(query, [match.url, dbC.id]);
                updatedCount++;
                console.log(`✅ Updated DB: "${dbC.name}" using Free-TV stream "${match.originalName}"`);
            }
        }
        
        await pool.end();
        console.log(`\nSuccessfully updated ${updatedCount} rows in the database using the new Free-TV list!`);
        
    } catch (e) {
        console.error('Error:', e);
    }
}

main();
