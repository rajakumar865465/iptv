require('dotenv').config({ path: __dirname + '/../.env' });
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function run() {
  const listFile = path.join(__dirname, '../../channels_to_process.txt');
  if (!fs.existsSync(listFile)) {
    console.error('List file not found at', listFile);
    process.exit(1);
  }

  const token = jwt.sign({ userId: 1, role: 'admin' }, process.env.ADMIN_JWT_SECRET || 'dev-admin-secret-change-in-production', { expiresIn: '1h' });
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const BASE_URL = 'http://127.0.0.1:5000/api';

  console.log('Fetching existing channels and categories...');
  const chanRes = await fetch(`${BASE_URL}/internal/channels?limit=5000`, { headers }).then(r => r.json());
  if (!chanRes.success) {
    console.error('Failed to fetch channels, verify admin token logic', chanRes);
    process.exit(1);
  }
  const existingChannels = chanRes.data || [];

  const catRes = await fetch(`${BASE_URL}/categories`).then(r => r.json());
  const categories = catRes.data || [];
  
  // Default category fallback
  const defaultCategory = categories.find(c => c.name.toLowerCase() === 'general') || categories[0];

  const rawLines = fs.readFileSync(listFile, 'utf8').split('\n');
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const line of rawLines) {
    if (!line.trim() || line.startsWith('#') || !line.includes('|')) continue;

    const parts = line.split('|').map(p => p.trim());
    let rawName = parts[0];
    const streamUrl = parts[1];
    const logoPart = parts[2] || '';
    
    // Extract logo URL
    let logoUrl = '';
    if (logoPart.startsWith('logo=')) {
      logoUrl = logoPart.substring(5).trim();
    }

    // Parse messy names like: like Gecko) Chrome/147.0.0.0 Safari/537.36" group-title="Movies",Anmol Cinema (576p)
    let groupTitle = '';
    if (rawName.includes('group-title="')) {
      const match = rawName.match(/group-title="([^"]+)"/);
      if (match) groupTitle = match[1];
    }
    
    if (rawName.includes(',')) {
      rawName = rawName.split(',').pop().trim();
    }

    const name = rawName;
    if (!name || !streamUrl) continue;

    // Find category ID
    let categoryId = defaultCategory ? defaultCategory.id : null;
    if (groupTitle) {
      const matchedCat = categories.find(c => c.name.toLowerCase() === groupTitle.toLowerCase());
      if (matchedCat) categoryId = matchedCat.id;
    }

    const existing = existingChannels.find(c => c.name.toLowerCase() === name.toLowerCase());

    if (!existing) {
      // Add missing channel
      console.log(`[ADD] Adding missing channel: ${name}`);
      const res = await fetch(`${BASE_URL}/internal/channels`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name,
          category_id: categoryId,
          stream_url: streamUrl,
          logo_url: logoUrl,
          status: 'active'
        })
      });
      const data = await res.json();
      if (!data.success) console.error(`  Error adding ${name}:`, data.message);
      else added++;
    } else {
      // Exist: check if not working
      const isWorking = existing.health_status === 'online' || existing.health_status === 'working';
      if (!isWorking) {
        console.log(`[UPDATE] Updating not working channel (${existing.health_status}): ${name}`);
        const res = await fetch(`${BASE_URL}/internal/channels/${existing.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            stream_url: streamUrl,
            status: 'active' // Ensure it is set to active
          })
        });
        const data = await res.json();
        if (!data.success) console.error(`  Error updating ${name}:`, data.message);
        else updated++;
      } else {
        console.log(`[SKIP] Channel already exists and is working: ${name}`);
        skipped++;
      }
    }
    await sleep(50); // slight delay to prevent overwhelming
  }

  console.log(`\n=== IMPORT COMPLETE ===`);
  console.log(`Added: ${added}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
}

run();
