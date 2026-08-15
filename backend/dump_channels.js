// SECURITY NOTE: this script used to contain a hardcoded JWT signing secret
// that matched the server's real ADMIN_JWT_SECRET, along with a hardcoded
// server IP. Both have been removed. If this secret was ever real, it MUST
// be rotated (ADMIN_JWT_SECRET in the backend's production environment) and
// all existing admin sessions invalidated, since anyone with access to this
// file's git history could mint valid admin tokens.
//
// This script now requires the real admin token/secret to be supplied via
// environment variables instead of being embedded in source.
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');

const BACKEND_URL = process.env.BACKEND_URL || process.env.DUMP_BACKEND_URL;
const ADMIN_TOKEN = process.env.DUMP_ADMIN_TOKEN; // a real, already-issued admin Bearer token

if (!BACKEND_URL || !ADMIN_TOKEN) {
  console.error('Set BACKEND_URL and DUMP_ADMIN_TOKEN environment variables before running this script.');
  console.error('Example: DUMP_ADMIN_TOKEN="<bearer token>" BACKEND_URL="https://your-api-host" node dump_channels.js');
  process.exit(1);
}

fetch(`${BACKEND_URL}/api/internal/channels?limit=5000`, {
  headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
})
  .then(r => r.json())
  .then(data => {
    if (!data.data || !Array.isArray(data.data)) {
      console.error('Invalid response:', data);
      return;
    }

    const channels = data.data;

    // Group by category and status
    let working = '';
    let notWorking = '';

    const cats = {};
    for (const c of channels) {
      const cat = c.category_name || 'Uncategorized';
      if (!cats[cat]) cats[cat] = { working: [], notWorking: [] };

      if (c.health_status === 'online' || c.health_status === 'working') {
        cats[cat].working.push(c.name);
      } else {
        cats[cat].notWorking.push(`${c.name} (${c.health_status})`);
      }
    }

    // Format output
    for (const [cat, catData] of Object.entries(cats)) {
      if (catData.working.length > 0) {
        working += `\n--- ${cat} (${catData.working.length} channels) ---\n`;
        working += catData.working.join('\n') + '\n';
      }

      if (catData.notWorking.length > 0) {
        notWorking += `\n--- ${cat} (${catData.notWorking.length} channels) ---\n`;
        notWorking += catData.notWorking.join('\n') + '\n';
      }
    }

    fs.writeFileSync(require('path').join(__dirname, '..', 'working_channels.txt'), working);
    fs.writeFileSync(require('path').join(__dirname, '..', 'not_working_channels.txt'), notWorking);

    console.log('Saved working_channels.txt and not_working_channels.txt');
    console.log(`Total Working: ${channels.filter(c => c.health_status === 'online' || c.health_status === 'working').length}`);
    console.log(`Total Not Working: ${channels.filter(c => c.health_status !== 'online' && c.health_status !== 'working').length}`);
  })
  .catch(console.error);
