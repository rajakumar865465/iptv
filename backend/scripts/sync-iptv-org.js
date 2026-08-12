require('dotenv').config();
const { runIptvOrgSync } = require('../src/services/iptvOrgSync');
const db = require('../src/config/db');

async function main() {
  try {
    // Check if --india-only flag is passed
    const indiaOnly = process.argv.includes('--india-only');
    const importGlobal = !indiaOnly;
    
    await runIptvOrgSync(importGlobal);
  } catch (err) {
    console.error('Failed to sync iptv-org channels:', err);
  } finally {
    process.exit(0);
  }
}

main();
