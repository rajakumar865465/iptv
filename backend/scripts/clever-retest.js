require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/db');
const https = require('https');
const http = require('http');

async function checkStreamClever(url, timeoutMs = 20000) {
  return new Promise((resolve) => {
    // Cleverly rotate User-Agents to bypass basic blocks
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'VLC/3.0.18 LibVLC/3.0.18',
      'ExoPlayerDemo/2.15.1 (Linux; Android 11)'
    ];
    
    // Choose a random user agent
    const ua = userAgents[Math.floor(Math.random() * userAgents.length)];
    
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    
    const req = client.get(url, {
      timeout: timeoutMs,
      rejectUnauthorized: false, // Clever: Ignore expired SSL certificates
      headers: {
        'User-Agent': ua,
        'Accept': '*/*',
        'Connection': 'keep-alive'
      }
    }, (res) => {
      // Clever: Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(checkStreamClever(res.headers.location, timeoutMs));
      }
      
      if (res.statusCode === 200) {
        let body = '';
        res.on('data', chunk => {
          body += chunk.toString();
          // Stop downloading early if we confirm it's a playlist
          if (body.length > 500) {
            req.destroy();
            resolve(body.includes('#EXTM3U') ? 'online' : 'not_hls');
          }
        });
        res.on('end', () => {
          resolve(body.includes('#EXTM3U') ? 'online' : 'not_hls');
        });
      } else if (res.statusCode === 403) {
        resolve('forbidden_403');
      } else if (res.statusCode === 404) {
        resolve('not_found_404');
      } else {
        resolve(`http_${res.statusCode}`);
      }
    });

    req.on('timeout', () => {
      req.destroy();
      resolve('timeout');
    });

    req.on('error', (err) => {
      resolve('http_req_error');
    });
  });
}

async function main() {
  console.log('🔍 Starting Clever Retest on Failed Streams...');
  
  // Fetch channels that failed due to timeout, 403, or http errors
  const res = await db.query(`
    SELECT cs.id, c.name, cs.stream_url, cs.health_reason 
    FROM channel_streams cs 
    JOIN channels c ON cs.channel_id = c.id 
    WHERE cs.health_reason IN ('timeout', 'forbidden_403', 'http_req_error')
  `);
  
  const channels = res.rows;
  console.log(`Found ${channels.length} recoverable failed streams to re-test.\n`);

  let recovered = 0;

  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i];
    process.stdout.write(`[${i+1}/${channels.length}] Testing ${ch.name} (${ch.health_reason})... `);
    
    // We give it a long 20-second timeout and fake browser headers
    const newStatus = await checkStreamClever(ch.stream_url, 20000);
    
    if (newStatus === 'online') {
      console.log('✅ RECOVERED! Stream is actually online!');
      recovered++;
      // Update DB to mark as online
      await db.query(`UPDATE channel_streams SET health_status = 'online', health_reason = NULL, last_checked = NOW() WHERE id = $1`, [ch.id]);
      await db.query(`UPDATE channels SET health_status = 'online' WHERE id = $1`, [ch.id]); // Activate channel
    } else {
      console.log(`❌ Still failing (${newStatus})`);
    }
  }

  console.log(`\n🎉 Clever Retest Complete! Recovered ${recovered} channels that previously failed.`);
  process.exit(0);
}

main().catch(console.error);
