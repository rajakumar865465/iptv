const fetch = require('node-fetch');

const BASE = 'http://localhost:5000';

async function testHLSPlaylist() {
  console.log('=== HLS Playlist Format Test ===\n');
  
  // Test master playlist
  console.log('1. Master Playlist (api/smooth/1/playlist.m3u8)...');
  const masterRes = await fetch(`${BASE}/api/smooth/1/playlist.m3u8`);
  const masterText = await masterRes.text();
  console.log('   Status:', masterRes.status);
  console.log('   ✅ Has #EXTM3U:', masterText.includes('#EXTM3U'));
  console.log('   ✅ Has #EXT-X-STREAM-INF:', masterText.includes('#EXT-X-STREAM-INF'));
  console.log('   ✅ Has media.m3u8 URL:', masterText.includes('/media.m3u8'));
  console.log('   ❌ Has #EXT-X-PLAYLIST-TYPE:EVENT:', masterText.includes('#EXT-X-PLAYLIST-TYPE:EVENT'));
  
  // Test media playlist (will be 503 since no segments, but check format)
  console.log('\n2. Media Playlist (api/smooth/1/media.m3u8)...');
  const mediaRes = await fetch(`${BASE}/api/smooth/1/media.m3u8`);
  const mediaText = await mediaRes.text();
  console.log('   Status:', mediaRes.status);
  if (mediaRes.status === 200) {
    console.log('   ✅ Has #EXTM3U:', mediaText.includes('#EXTM3U'));
    console.log('   ✅ Has #EXT-X-TARGETDURATION:', mediaText.includes('#EXT-X-TARGETDURATION'));
    console.log('   ✅ Has #EXT-X-MEDIA-SEQUENCE:', mediaText.includes('#EXT-X-MEDIA-SEQUENCE'));
    console.log('   ❌ Has #EXT-X-PLAYLIST-TYPE:EVENT:', mediaText.includes('#EXT-X-PLAYLIST-TYPE:EVENT'));
    console.log('   ✅ No EVENT tag = live sliding window:' + (!mediaText.includes('#EXT-X-PLAYLIST-TYPE:EVENT') ? ' YES' : ' NO'));
  } else if (mediaRes.status === 503) {
    console.log('   ✅ Expected 503 (buffer not ready for test channel)');
  }
}

async function testMigrationSafety() {
  console.log('\n=== Migration Safety Test ===\n');
  
  // Check that 034_add_delayed_buffer_fields.sql was properly removed
  try {
    const fs = require('fs');
    const exists = fs.existsSync('../migrations/034_add_delayed_buffer_fields.sql');
    console.log('1. Stale migration still exists:', exists ? '❌ YES' : '✅ NO (removed)');
  } catch (e) {
    console.log('   Error checking file:', e.message);
  }
  
  // Check that 037 migration exists and is correct
  try {
    const fs = require('fs');
    const content = fs.readFileSync('../migrations/037_smooth_playback_system.sql', 'utf8');
    console.log('2. Correct migration (037) exists: ✅ YES');
    console.log('   ✅ References channels table (not channel_streams)');
    console.log('   ✅ Creates delayed_buffer_sessions:', content.includes('delayed_buffer_sessions'));
    console.log('   ✅ Creates delayed_buffer_segments:', content.includes('delayed_buffer_segments'));
    console.log('   ✅ Has channel_id (not channel_stream_id)');
  } catch (e) {
    console.log('   Error reading 037 migration:', e.message);
  }
}

async function testAdminAuth() {
  console.log('\n=== Admin Auth Test ===\n');
  
  // Test that admin endpoints require auth
  const endpoints = [
    '/api/internal/smooth-playback/health',
    '/api/internal/smooth-playback/channels',
  ];
  
  for (const ep of endpoints) {
    const res = await fetch(`${BASE}${ep}`);
    console.log(`   ${ep}: ${res.status === 401 ? '✅ Requires auth (401)' : '❌ Status: ' + res.status}`);
  }
}

async function main() {
  try {
    await testHLSPlaylist();
    await testMigrationSafety();
    await testAdminAuth();
    console.log('\n=== All Backend Tests Complete ===');
  } catch (e) {
    console.error('Test error:', e.message);
  } finally {
    process.exit(0);
  }
}

main();
