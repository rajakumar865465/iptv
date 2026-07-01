const fs = require('fs');
const https = require('https');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

function cleanName(name) {
    if (!name) return '';
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function fetchIptvOrg() {
    return new Promise((resolve, reject) => {
        const url = 'https://iptv-org.github.io/iptv/index.m3u';
        console.log(`Fetching ${url}...`);
        
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                return reject(new Error(`Failed to fetch iptv-org M3U: ${res.statusCode}`));
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
            const cName = cleanName(currentName);
            if (cName && !channels.has(cName)) {
                channels.set(cName, line.trim());
            }
        }
    }
    return channels;
}

async function main() {
    try {
        // Read broken channels
        const notWorkingContent = fs.readFileSync('../scan_not_working.txt', 'utf8');
        const brokenNames = new Set();
        const brokenLines = notWorkingContent.split(/\r?\n/);
        for (const line of brokenLines) {
            if (line && !line.startsWith('http')) {
                // Name format is "Channel Name (Error: ...)"
                const match = line.match(/^(.*?)\s*\(Error:/);
                if (match && match[1]) {
                    brokenNames.add(match[1].trim());
                } else if (!line.includes('(Error:')) {
                    brokenNames.add(line.trim());
                }
            }
        }
        
        console.log(`Loaded ${brokenNames.size} broken channels to search for.`);

        // Fetch iptv-org DB
        const iptvOrgContent = await fetchIptvOrg();
        const iptvOrgChannels = parseM3u(iptvOrgContent);
        console.log(`Loaded ${iptvOrgChannels.size} channels from iptv-org.`);

        // Find matches
        const recovered = [];
        for (const brokenName of brokenNames) {
            const cName = cleanName(brokenName);
            if (iptvOrgChannels.has(cName)) {
                recovered.push({ name: brokenName, url: iptvOrgChannels.get(cName) });
            }
        }
        
        console.log(`\n🎉 Found ${recovered.length} replacement streams!`);
        
        if (recovered.length === 0) {
            console.log('No matches found. Exiting.');
            return;
        }

        console.log('\nConnecting to Database...');
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
        let updatedCount = 0;
        
        for (const r of recovered) {
            // Update in DB (using ILIKE for case-insensitive match just in case)
            const query = `
                UPDATE channels 
                SET backup_stream_url = stream_url, 
                    stream_url = $1, 
                    status = 'active',
                    updated_at = NOW()
                WHERE name ILIKE $2
                RETURNING id;
            `;
            const result = await pool.query(query, [r.url, `%${r.name}%`]);
            if (result.rowCount > 0) {
                updatedCount += result.rowCount;
                console.log(`✅ Updated in DB: ${r.name}`);
            }
        }
        
        await pool.end();
        console.log(`\nSuccessfully updated ${updatedCount} rows in the database.`);
        
        // Save recovered to a file just for reference
        fs.writeFileSync('../recovered_channels.txt', recovered.map(r => `${r.name}\n${r.url}`).join('\n\n'));
        console.log('Saved recovered URLs to ../recovered_channels.txt');
        
    } catch (e) {
        console.error('Error during recovery:', e);
    }
}

main();
