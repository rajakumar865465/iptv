const fetch = require('node-fetch');

const BASE = 'http://localhost:5000';

async function test() {
  console.log('=== Smooth Playback API Tests ===\n');

  // 1. Test smooth playback API for a known channel
  console.log('1. Testing GET /api/channels/{id}/smooth-playback...');
  try {
    const smoothRes = await fetch(`${BASE}/api/channels/9/smooth-playback`);
    const smoothData = await smoothRes.json();
    console.log('   Status:', smoothRes.status);
    console.log('   Response:', JSON.stringify(smoothData, null, 2));
  } catch (e) {
    console.log('   Smooth playback API test failed (expected if no channel 1):', e.message);
  }

  // 2. Test direct playback API
  console.log('\n2. Testing GET /api/channels/{id}/playback...');
  try {
    const playbackRes = await fetch(`${BASE}/api/channels/9/playback`);
    const playbackData = await playbackRes.json();
    console.log('   Status:', playbackRes.status);
    console.log('   Has primary_stream:', !!playbackData.data?.primary_stream);
  } catch (e) {
    console.log('   Playback API test failed:', e.message);
  }

  // 3. Test buffer health API (admin)
  console.log('\n3. Testing GET /api/internal/smooth-playback/health...');
  try {
    const healthRes = await fetch(`${BASE}/api/internal/smooth-playback/health`);
    const healthData = await healthRes.json();
    console.log('   Status:', healthRes.status);
    console.log('   Has segment_missing_count:', healthData.data?.segment_missing_count !== undefined);
    console.log('   Data keys:', Object.keys(healthData.data || {}).join(', '));
  } catch (e) {
    console.log('   Buffer health API failed:', e.message);
  }

  // 4. Test smooth playback channels list
  console.log('\n4. Testing GET /api/internal/smooth-playback/channels...');
  try {
    const channelsRes = await fetch(`${BASE}/api/internal/smooth-playback/channels`);
    const channelsData = await channelsRes.json();
    console.log('   Status:', channelsRes.status);
    console.log('   Channels count:', channelsData.data?.channels?.length || 0);
  } catch (e) {
    console.log('   Smooth playback channels API failed:', e.message);
  }

  // 5. Test delayed HLS playlist endpoint (public)
  console.log('\n5. Testing GET /api/smooth/{id}/playlist.m3u8...');
  try {
    const playlistRes = await fetch(`${BASE}/api/smooth/9/playlist.m3u8`);
    const playlistText = await playlistRes.text();
    console.log('   Status:', playlistRes.status);
    console.log('   Has #EXTM3U:', playlistText.includes('#EXTM3U'));
    console.log('   Has #EXT-X-TARGETDURATION:', playlistText.includes('#EXT-X-TARGETDURATION'));
    console.log('   Has #EXT-X-PLAYLIST-TYPE:EVENT:', playlistText.includes('#EXT-X-PLAYLIST-TYPE:EVENT'));
    console.log('   First 300 chars:', playlistText.substring(0, 300));
  } catch (e) {
    console.log('   Playlist test failed:', e.message);
  }

  // 6. Test proxy security
  console.log('\n6. Testing Proxy Security...');
  try {
    const masterRes = await fetch(`${BASE}/api/proxy/1/master.m3u8`);
    console.log('   Master without token status:', masterRes.status);
    
    const segmentRes = await fetch(`${BASE}/api/proxy/segment/1/badtoken`);
    console.log('   Segment with bad token status:', segmentRes.status);
  } catch (e) {
    console.log('   Proxy security test failed:', e.message);
  }

  console.log('\n=== Tests Complete ===');
}

test().catch(console.error);
