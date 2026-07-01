const fs = require('fs');
const http = require('http');
const https = require('https');
const readline = require('readline');

async function checkUrl(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      
      const req = client.request(url, { method: 'GET', timeout: timeoutMs }, (res) => {
        // Destroy the response stream immediately since we only care about headers/status
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
  const fileStream = fs.createReadStream('working_iptv.m3u');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let channels = [];
  let currentName = '';
  
  for await (const line of rl) {
    if (line.startsWith('#EXTINF')) {
        const parts = line.split(',');
        currentName = parts.length > 1 ? parts[1].trim() : 'Unknown';
    } else if (line.trim() && !line.startsWith('#')) {
        channels.push({ name: currentName, url: line.trim() });
    }
  }

  console.log(`Found ${channels.length} channels. Starting scan (this may take a few minutes)...`);

  let working = [];
  let notWorking = [];
  
  // To avoid exhausting sockets, run in batches
  const batchSize = 50;
  for (let i = 0; i < channels.length; i += batchSize) {
    const batch = channels.slice(i, i + batchSize);
    const promises = batch.map(async (ch) => {
        const result = await checkUrl(ch.url);
        if (result.ok) {
            working.push(ch);
        } else {
            notWorking.push({ ...ch, error: result.status });
        }
    });
    await Promise.all(promises);
    console.log(`Processed ${Math.min(i + batchSize, channels.length)} / ${channels.length}...`);
  }

  console.log(`\nScan Complete!`);
  console.log(`Working: ${working.length}`);
  console.log(`Not Working: ${notWorking.length}`);
  
  fs.writeFileSync('scan_working.txt', working.map(ch => `${ch.name}\n${ch.url}`).join('\n\n'));
  fs.writeFileSync('scan_not_working.txt', notWorking.map(ch => `${ch.name} (Error: ${ch.error})\n${ch.url}`).join('\n\n'));
  console.log('Results saved to scan_working.txt and scan_not_working.txt');
}

main();
