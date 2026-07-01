const http = require('http');
const https = require('https');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

async function checkUrl(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      
      const req = client.request(url, { method: 'GET', timeout: timeoutMs }, (res) => {
        res.destroy();
        if (res.statusCode >= 200 && res.statusCode < 400) {
            resolve({ ok: true, status: res.statusCode });
        } else {
            resolve({ ok: false, status: res.statusCode });
        }
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, status: 'timeout' });
      });

      req.on('error', (err) => {
        resolve({ ok: false, status: err.message });
      });

      req.end();
    } catch (e) {
      resolve({ ok: false, status: 'invalid url' });
    }
  });
}

async function main() {
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
    
    try {
        console.log('Fetching channels from database...');
        const res = await pool.query("SELECT id, name, stream_url FROM channels WHERE status = 'active'");
        const channels = res.rows;
        console.log(`Found ${channels.length} active channels in DB to test. This will take a moment...`);
        
        let working = 0;
        let notWorking = 0;
        
        const batchSize = 50;
        for (let i = 0; i < channels.length; i += batchSize) {
            const batch = channels.slice(i, i + batchSize);
            const promises = batch.map(async (ch) => {
                const result = await checkUrl(ch.stream_url);
                if (result.ok) {
                    working++;
                } else {
                    notWorking++;
                }
            });
            await Promise.all(promises);
            console.log(`Tested ${Math.min(i + batchSize, channels.length)} / ${channels.length}...`);
        }
        
        console.log(`\nScan Complete for Database Channels!`);
        console.log(`✅ Working: ${working}`);
        console.log(`❌ Not Working: ${notWorking}`);
        
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

main();
