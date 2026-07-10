require('dotenv').config({ path: __dirname + '/../.env' });
const jwt = require('jsonwebtoken');

async function run() {
  const token = jwt.sign({ userId: 3, role: 'admin' }, process.env.ADMIN_JWT_SECRET || 'dev-admin-secret-change-in-production', { expiresIn: '1h' });
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const BASE_URL = 'http://127.0.0.1:5000/api';

  console.log('Fetching channels and categories...');
  const chanRes = await fetch(`${BASE_URL}/internal/channels?limit=5000`, { headers }).then(r => r.json());
  if (!chanRes.success) {
    console.error('Failed to fetch channels');
    process.exit(1);
  }
  const channels = chanRes.data || [];

  const catRes = await fetch(`${BASE_URL}/categories`).then(r => r.json());
  const categories = catRes.data || [];

  function getCatId(name) {
    const c = categories.find(x => x.name.toLowerCase() === name.toLowerCase());
    return c ? c.id : null;
  }

  // Pre-fetch category IDs
  const cats = {
    News: getCatId('News'),
    Movies: getCatId('Movies'),
    Music: getCatId('Music'),
    Devotional: getCatId('Devotional'),
    Business: getCatId('Business'),
    Kids: getCatId('Kids'),
    Sports: getCatId('Sports'),
    Doordarshan: getCatId('Doordarshan'),
    Entertainment: getCatId('Entertainment'),
    Regional: getCatId('Regional')
  };

  function guessCategory(channelName) {
    const n = channelName.toLowerCase();
    if (n.includes('news') || n.includes('aaj tak') || n.includes('abp ') || n.includes('india tv') || n.includes('ndtv') || n.includes('bharat') || n.includes('sudarshan') || n.includes('taaza') || n.includes('24') || n.includes('amarujala')) return cats.News;
    if (n.includes('movie') || n.includes('cinema') || n.includes('goldmines') || n.includes('b4u movies') || n.includes('flix') || n.includes('plex')) return cats.Movies;
    if (n.includes('music') || n.includes('9x') || n.includes('mtv') || n.includes('zoom') || n.includes('stingray')) return cats.Music;
    if (n.includes('devotional') || n.includes('aastha') || n.includes('bhakti') || n.includes('darshan') || n.includes('god ') || n.includes('hare krsna') || n.includes('sanskar') || n.includes('satsang') || n.includes('shubh') || n.includes('vedic') || n.includes('divya') || n.includes('adhyatm')) return cats.Devotional;
    if (n.includes('business') || n.includes('cnbc') || n.includes('bloomberg') || n.includes('profit')) return cats.Business;
    if (n.includes('kids') || n.includes('cartoon') || n.includes('animax') || n.includes('disney')) return cats.Kids;
    if (n.includes('sports') || n.includes('espn') || n.includes('tennis') || n.includes('nba')) return cats.Sports;
    if (n.includes('dd ')) return cats.Doordarshan;
    if (n.includes('entertainment') || n.includes('comedy') || n.includes('sony') || n.includes('star ') || n.includes('colors')) return cats.Entertainment;
    if (n.includes('punjab') || n.includes('bangla') || n.includes('marathi') || n.includes('telugu') || n.includes('tamil') || n.includes('kannada') || n.includes('malayalam')) return cats.Regional;
    
    return null; // Don't change if we can't guess
  }

  let updated = 0;
  for (const c of channels) {
    const newCatId = guessCategory(c.name);
    
    // Only update if we guessed a category AND it's different from the current one
    if (newCatId && c.category_id !== newCatId) {
      console.log(`Updating [${c.name}] to new category ID ${newCatId}`);
      const res = await fetch(`${BASE_URL}/internal/channels/${c.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ category_id: newCatId })
      });
      const data = await res.json();
      if (data.success) updated++;
      else console.error(`Failed to update ${c.name}:`, data.message);
    }
  }

  console.log(`\n=== CATEGORY UPDATE COMPLETE ===`);
  console.log(`Successfully categorized ${updated} channels.`);
}

run();
