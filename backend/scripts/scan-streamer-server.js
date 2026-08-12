const http = require('http');

const SERVER_IP = '38.96.178.205';
const COMMON_PATHS = [
  'STARTV', 'STARTVHD', 'STARPLUS', 'STARPLUSHD',
  'ZEETV', 'ZEETVHD', 'ZEE', 'ZEEHD',
  'COLORS', 'COLORSHD', 'COLORSTV', 'COLORSTVHD',
  'SONY', 'SONYHD', 'SONYTV', 'SONYTVHD',
  'ZEECINE', 'ZEECINEMA', 'ZEECINEMAHD', 'ZEECINEHD',
  'SONYMAX', 'SONYMAXHD', 'MAX', 'MAXHD',
  'STARGOLD', 'STARGOLDHD', 'GOLD', 'GOLDHD',
  'STARBHARAT', 'STARBHARATHD', 'SAB', 'SABTV', 'SABHD',
  'ANDTV', 'ANDTVHD', 'NTV', 'STARMOVIES', 'STARMOVIESHD',
  'HBO', 'HBOHD', 'CN', 'DISNEY', 'DISNEYHD', 'NICK', 'NICKHD'
];

async function checkUrl(path) {
  const url = `http://${SERVER_IP}/${path}/index.m3u8`;
  return new Promise((resolve) => {
    const req = http.request(url, { method: 'HEAD', timeout: 5000 }, (res) => {
      resolve({ path, url, ok: res.statusCode === 200, status: res.statusCode });
    });
    req.on('error', (err) => resolve({ path, url, ok: false, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ path, url, ok: false, error: 'timeout' }); });
    req.end();
  });
}

async function run() {
  console.log(`Scanning http://${SERVER_IP}/ for working channels...`);
  const working = [];
  
  for (let i = 0; i < COMMON_PATHS.length; i += 5) {
    const batch = COMMON_PATHS.slice(i, i + 5);
    const results = await Promise.all(batch.map(p => checkUrl(p)));
    
    for (const r of results) {
      if (r.ok) {
        console.log(`\n✅ FOUND: ${r.url}`);
        working.push(r.url);
      } else {
        process.stdout.write('.');
      }
    }
  }
  
  console.log('\n\nScan complete. Working URLs found:');
  console.log(working.join('\n'));
}

run();
