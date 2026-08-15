const fs = require('fs');
const https = require('https');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

function cleanName(name) {
    if (!name) return '';
    // Remove anything in brackets or parentheses first: "Channel (720p)" -> "Channel "
    name = name.replace(/\s*[\(\[].*?[\)\]]/g, '');
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function fetchIptvOrg() {
    return new Promise((resolve, reject) => {
        const url = 'https://iptv-org.github.io/iptv/index.m3u';
        https.get(url, (res) => {
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
        console.log('Fetching iptv-org DB...');
        const iptvOrgContent = await fetchIptvOrg();
        const iptvOrgChannels = parseM3u(iptvOrgContent);
        console.log(`Loaded ${iptvOrgChannels.size} channels from iptv-org.`);

        if (!process.env.DATABASE_URL) {
            console.error('DATABASE_URL is not set. Refusing to connect without an explicit connection string.');
            process.exit(1);
        }

        console.log('Connecting to Database...');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
        });

        // Get all channels from the DB
        const result = await pool.query('SELECT id, name FROM channels');
        const dbChannels = result.rows;

        let updatedCount = 0;

        for (const dbChan of dbChannels) {
            const cName = cleanName(dbChan.name);
            if (iptvOrgChannels.has(cName)) {
                const newUrl = iptvOrgChannels.get(cName);
                const updateRes = await pool.query(
                    `UPDATE channels SET stream_url = $1, status = 'active', health_status = 'unknown', updated_at = NOW() WHERE id = $2`,
                    [newUrl, dbChan.id]
                );
                if (updateRes.rowCount > 0) {
                    updatedCount++;
                }
            }
        }

        await pool.end();
        console.log(`Successfully updated ${updatedCount} rows in the database.`);
    } catch (e) {
        console.error('Error during recovery:', e);
    }
}

main();
