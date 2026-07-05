require('dotenv').config({ path: __dirname + '/../.env' });
const scanner = require('../src/controllers/scannerController');

async function main() {
  const url = process.argv[2] || 'https://dai.google.com/linear/hls/event/sL-6k_WOTxWz5FzH4b9uHw/master.m3u8';
  console.log(`Testing checkDeep on ${url}...`);
  try {
    const res = await scanner.checkDeep(url, {
      'User-Agent': 'ExoPlayer/2.18.1 (Linux; Android 11)'
    });
    console.log('Result:', res);
  } catch(e) {
    console.error('Crash:', e);
  }
  process.exit(0);
}

main();
